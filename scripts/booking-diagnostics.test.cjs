const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, dependencies, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Response, Request, URL, Error, ...globals,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name.startsWith("node:")) return require(name);
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return exports;
}

function setup(overrides = {}) {
  const logs = [];
  const logger = Object.fromEntries(["info", "warn", "error"].map((level) => [level, (entry) => logs.push(JSON.parse(entry))]));
  const diagnostics = load("lib/booking-diagnostics.ts", { "server-only": {} }, {
    console: logger, process: { env: { BLOB_READ_WRITE_TOKEN: "secret-test-token" } },
  });
  const reservation = { id: 7, name: "Private Guest", email: "private@example.com", inviteCode: "PRIVATECODE" };
  const api = load("app/api/reservations/route.ts", {
    "@/lib/booking-diagnostics": diagnostics,
    "@/lib/rate-limit": { pruneRateLimitBuckets() {}, getClientKey() { return "test"; }, checkRateLimit() { return { allowed: true }; } },
    "@/lib/validation": { validateReservationPayload(value) { return { ok: true, value }; } },
    "@/lib/email": { async sendInviteEmail() { return { status: "skipped" }; } },
    "@/lib/reservations": {
      async reserveSeat(input, trace) {
        trace.protect(input.name, input.email, reservation.inviteCode);
        trace.writeAttempted(); trace.writeConfirmed();
        return { ok: true, reservation, invitePath: "/invite/PRIVATECODE" };
      },
      async getAvailability() { return { totalSeats: 10, occupiedSeats: 1 }; },
      ...overrides,
    },
  });
  const request = () => new Request("http://localhost/api/reservations", {
    method: "POST", body: JSON.stringify({ name: reservation.name, email: reservation.email }),
  });
  return { api, logs, request, diagnostics };
}

test("successful response contains matching request ID without guest data in logs", async () => {
  const { api, logs, request } = setup();
  const response = await api.POST(request());
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
  assert.ok(logs.every((entry) => entry.requestId === body.requestId));
  assert.equal(logs.at(-1).writeState, "confirmed");
  assert.doesNotMatch(JSON.stringify(logs), /Private Guest|private@example.com|PRIVATECODE|secret-test-token/);
});

test("post-save failure identifies stage and confirmed write, without exposing details to browser", async () => {
  const { api, logs, request } = setup({ async getAvailability() {
    throw new Error("Storage unavailable for Private Guest private@example.com secret-test-token PRIVATECODE", { cause: new Error("Upstream timeout") });
  } });
  const response = await api.POST(request());
  const body = await response.json();
  assert.equal(response.status, 500);
  const failure = logs.find((entry) => entry.event === "booking.unhandled_failure");
  assert.equal(failure.stage, "response_availability");
  assert.equal(failure.writeState, "confirmed");
  assert.match(failure.error.message, /Storage unavailable/);
  assert.match(failure.error.stack, /Error/);
  assert.equal(failure.error.cause.message, "Upstream timeout");
  assert.doesNotMatch(JSON.stringify(logs), /Private Guest|private@example.com|PRIVATECODE|secret-test-token/);
  assert.doesNotMatch(JSON.stringify(body), /Storage unavailable|Upstream timeout|stack/);
  assert.equal(body.requestId, failure.requestId);
});

test("write failure records attempted rather than confirmed", async () => {
  const { api, logs, request } = setup({ async reserveSeat(input, trace) {
    trace.writeAttempted(); throw new Error("Blob write failed");
  } });
  assert.equal((await api.POST(request())).status, 500);
  assert.equal(logs.at(-1).stage, "blob_write");
  assert.equal(logs.at(-1).writeState, "attempted");
});

test("explicit failure and conflict responses are logged even without exceptions", async () => {
  for (const conflict of [false, true]) {
    const { api, logs, request } = setup({ async reserveSeat(input, trace) {
      trace.step("reservation_read_back");
      return { ok: false, conflict, error: "Reservation unavailable" };
    } });
    const response = await api.POST(request());
    const body = await response.json();
    assert.equal(response.status, conflict ? 409 : 500);
    assert.equal(logs.at(-1).status, response.status);
    assert.equal(logs.at(-1).requestId, body.requestId);
  }
});

test("malformed JSON produces correlated 400 without logging request contents", async () => {
  const { api, logs } = setup();
  const response = await api.POST(new Request("http://localhost/api/reservations", { method: "POST", body: "PRIVATE BROKEN PAYLOAD" }));
  assert.equal(response.status, 400);
  assert.ok((await response.json()).requestId);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE BROKEN PAYLOAD/);
});

test("redaction handles URLs, quoted records, secrets and cyclic causes", () => {
  const { diagnostics, logs } = setup();
  const trace = new diagnostics.BookingDiagnostics();
  const error = new Error('Provider failed at https://example.com/private?token=secret-test-token for "Other Guest"');
  error.cause = error;
  trace.log("error", "test", error);
  assert.doesNotMatch(JSON.stringify(logs), /secret-test-token|Other Guest|https:\/\/example.com/);
  assert.match(JSON.stringify(logs), /cause depth limit/);
});
