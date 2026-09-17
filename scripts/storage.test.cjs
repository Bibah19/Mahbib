const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const source = readFileSync(path.join(__dirname, "../lib/storage.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const options = { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false };
const readOptions = { access: "private", useCache: false };

function load(root, env = { NODE_ENV: "development" }, remote = {}) {
  const exports = {};
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  vm.runInNewContext(compiled, {
    exports, Response, Error, process: { env, cwd: () => root },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@vercel/blob") return { BlobNotFoundError, BlobPreconditionFailedError, ...remote };
      if (name.startsWith("node:")) return require(name);
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return exports;
}

async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), "wedding-storage-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("local files persist across adapter instances, paginate and release", async (t) => {
  const root = await temporary(t);
  const api = load(root);
  assert.equal((await api.list({ prefix: "reservations/", limit: 1 })).blobs.length, 0);
  await api.put("reservations/Table%201/1.json", '{"id":7}', options);
  await api.put("reservations/Table%201/2.json", '{"id":8}', options);
  const fresh = load(root);
  const stored = await fresh.get("reservations/Table%201/1.json", readOptions);
  assert.equal(await new Response(stored.stream).text(), '{"id":7}');
  const first = await fresh.list({ prefix: "reservations/", limit: 1 });
  assert.equal(first.blobs.length, 1);
  const second = await fresh.list({ prefix: "reservations/", limit: 1, cursor: first.cursor });
  assert.equal(second.blobs.length, 1);
  assert.notEqual(first.blobs[0].pathname, second.blobs[0].pathname);
  await fresh.del("reservations/Table%201/1.json");
  await assert.rejects(fresh.get("reservations/Table%201/1.json", readOptions), fresh.BlobNotFoundError);
});

test("concurrent local creates publish exactly one complete reservation", async (t) => {
  const api = load(await temporary(t));
  const pathname = "reservations/Table/1.json";
  const results = await Promise.allSettled([
    api.put(pathname, '{"id":1}', options), api.put(pathname, '{"id":2}', options),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(results.find((result) => result.status === "rejected").reason instanceof api.BlobPreconditionFailedError);
  const stored = await api.get(pathname, readOptions);
  assert.ok([1, 2].includes(JSON.parse(await new Response(stored.stream).text()).id));
  assert.equal((await api.list({ prefix: "reservations/", limit: 100 })).blobs.length, 1);
});

test("local adapter rejects paths outside its reservation directory", async (t) => {
  const api = load(await temporary(t));
  await assert.rejects(api.get("reservations/../../outside.json", readOptions), /Invalid/);
  await assert.rejects(api.put("outside.json", "{}", options), /Invalid/);
});

test("production never silently falls back to local files", async (t) => {
  const failure = new Error("Missing production credentials");
  const api = load(await temporary(t), { NODE_ENV: "production" }, {
    async list() { throw failure; },
  });
  await assert.rejects(api.list({ prefix: "reservations/", limit: 100 }), (error) => error === failure);
});

test("configured credentials select Blob even in development", async (t) => {
  let called = false;
  const api = load(await temporary(t), { NODE_ENV: "development", BLOB_READ_WRITE_TOKEN: "test-only" }, {
    async list() { called = true; return { blobs: [], hasMore: false }; },
  });
  await api.list({ prefix: "reservations/", limit: 100 });
  assert.equal(called, true);
});
