// Run with: node --test scripts/reservations.test.cjs
// Transpile the existing TypeScript with the installed compiler; all Blob I/O is local.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const source = readFileSync(path.join(__dirname, "../lib/reservations.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const input = { name: "Test Guest", email: "guest@example.com", category: "Family", table: "Table 1", seat: 1 };
const seatPath = (seat) => `reservations/Table%201/${seat}.json`;
const legacy = { ...input, id: 7, inviteCode: "ABCDEFGH", createdAt: "2026-01-01T00:00:00.000Z" };

function setup(initial = [], overrides = {}) {
  const blobs = new Map(initial.map((reservation) => [seatPath(reservation.seat), reservation]));
  // These legacy metadata objects must never be treated as reservations.
  blobs.set("reservations/_meta/id-map.json", { ids: [] });
  blobs.set("reservations/_meta/counter.json", { nextId: 1 });
  const writes = [];
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  const blob = {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async list({ prefix, cursor }) {
      const paths = [...blobs.keys()].filter((key) => key.startsWith(prefix));
      const offset = Number(cursor ?? 0);
      const page = paths.slice(offset, offset + 2);
      return {
        blobs: page.map((pathname) => ({ pathname })),
        cursor: offset + 2 < paths.length ? String(offset + 2) : undefined,
      };
    },
    async get(pathname) {
      if (!blobs.has(pathname)) throw new BlobNotFoundError();
      return { statusCode: 200, stream: new Response(JSON.stringify(blobs.get(pathname))).body };
    },
    async put(pathname, body, options) {
      writes.push({ pathname, options });
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.access, "private");
      if (blobs.has(pathname)) throw new BlobPreconditionFailedError();
      blobs.set(pathname, JSON.parse(body));
    },
    async del(pathname) { blobs.delete(pathname); },
    ...overrides,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Response, Error,
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name === "./storage") return blob;
      if (name === "./seating") return {
        getCategories: () => ["Family"],
        getCategoryQuota: () => 10,
        getTablesForCategory: () => [{ name: "Table 1", from: 1, to: 10, seatCount: 10 }],
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { api: exports, blobs, writes };
}

test("legacy numeric IDs work without an ID map, across list pages", async () => {
  const { api } = setup([legacy, { ...legacy, id: 8, seat: 2 }]);
  assert.equal((await api.getReservationById(7)).name, legacy.name);
  assert.equal((await api.getReservationById(8)).seat, 2);
  assert.equal(await api.getReservationById(999), null);
});

test("creates a fixed-path private reservation without metadata writes", async () => {
  const { api, writes } = setup();
  const result = await api.reserveSeat(input);
  assert.equal(result.ok, true);
  assert.ok(Number.isSafeInteger(result.reservation.id));
  assert.ok(result.reservation.id > 0);
  assert.equal(result.invitePath, `/invite/${result.reservation.inviteCode}`);
  assert.equal((await api.getReservationById(result.reservation.id)).seat, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].pathname, seatPath(1));
});

test("occupied seats return conflict without overwriting the guest", async () => {
  const { api, writes } = setup([legacy]);
  const result = await api.reserveSeat(input);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.availability.occupiedSeats, 1);
  assert.equal(writes.length, 0);
});

test("simultaneous requests cannot claim the same seat", async () => {
  const { api, blobs } = setup();
  const results = await Promise.all([api.reserveSeat(input), api.reserveSeat(input)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.conflict).length, 1);
  assert.ok(blobs.has(seatPath(1)));
});

test("release finds a legacy ID and frees only its seat", async () => {
  const { api, blobs } = setup([legacy, { ...legacy, id: 8, seat: 2 }]);
  assert.equal(await api.releaseSeat(7), true);
  assert.equal(blobs.has(seatPath(1)), false);
  assert.equal(blobs.has(seatPath(2)), true);
  assert.equal(await api.releaseSeat(7), false);
});

test("newest reservations sort first regardless of their random ID", async () => {
  const { api } = setup([legacy, { ...legacy, id: 2, seat: 2, createdAt: "2026-02-01T00:00:00.000Z" }]);
  assert.equal((await api.listReservations())[0].id, 2);
});

test("storage failures are not mistaken for an available seat", async () => {
  const failure = new Error("Storage unavailable");
  const { api } = setup([], { async get() { throw failure; } });
  await assert.rejects(api.isSeatAvailable("Table 1", 1), (error) => error === failure);
});
