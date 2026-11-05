// Run with: node --test scripts/reservations.test.cjs
// Transpiles lib/reservations.ts and runs it against an in-memory fake of ./db.
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
const legacy = { ...input, id: 7, inviteCode: "ABCDEFGH", createdAt: "2026-01-01T00:00:00.000Z" };

const toRow = (r) => ({
  id: String(r.id), invite_code: r.inviteCode, name: r.name, email: r.email,
  category: r.category, table_name: r.table, seat: r.seat, created_at: new Date(r.createdAt),
});

function setup(initial = [], overrides = {}) {
  const rows = initial.map(toRow);
  const inserts = [];
  const unique = (constraint) => Object.assign(new Error("duplicate key"), { code: "23505", constraint });

  async function query(text, params = []) {
    if (overrides.query) return overrides.query(text, params);
    const sql = text.replace(/\s+/g, " ").trim();
    if (sql.startsWith("SELECT table_name, seat")) return { rows: rows.map((r) => ({ table_name: r.table_name, seat: r.seat })) };
    if (sql.includes("WHERE id = $1") && sql.startsWith("SELECT"))
      return { rows: rows.filter((r) => r.id === String(params[0])) };
    if (sql.includes("WHERE invite_code = $1")) return { rows: rows.filter((r) => r.invite_code === params[0]) };
    if (sql.includes("WHERE table_name = $1 AND seat = $2"))
      return { rows: rows.filter((r) => r.table_name === params[0] && r.seat === params[1]) };
    if (sql.startsWith("SELECT"))
      return { rows: [...rows].sort((a, b) => b.created_at - a.created_at || Number(b.id) - Number(a.id)) };
    if (sql.startsWith("INSERT")) {
      const [id, invite_code, name, email, category, table_name, seat] = params;
      inserts.push(params);
      if (rows.some((r) => r.table_name === table_name && r.seat === seat)) throw unique("reservations_table_name_seat_key");
      if (rows.some((r) => r.invite_code === invite_code)) throw unique("reservations_invite_code_key");
      const row = { id: String(id), invite_code, name, email, category, table_name, seat, created_at: new Date() };
      rows.push(row);
      return { rows: [row] };
    }
    if (sql.startsWith("DELETE")) {
      const i = rows.findIndex((r) => r.id === String(params[0]));
      if (i >= 0) rows.splice(i, 1);
      return { rowCount: i >= 0 ? 1 : 0, rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }

  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Error, Date, Number, String,
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name === "./db") return { query };
      if (name === "./seating") return {
        getCategories: () => ["Family"],
        getCategoryQuota: () => 10,
        getTablesForCategory: () => [{ name: "Table 1", from: 1, to: 10, seatCount: 10 }],
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { api: exports, rows, inserts };
}

test("looks up reservations by numeric ID", async () => {
  const { api } = setup([legacy, { ...legacy, id: 8, seat: 2, inviteCode: "ZZZZZZZZ" }]);
  assert.equal((await api.getReservationById(7)).name, legacy.name);
  assert.equal((await api.getReservationById(8)).seat, 2);
  assert.equal(await api.getReservationById(999), null);
});

test("looks up reservations by invite code, case-insensitively", async () => {
  const { api } = setup([legacy]);
  assert.equal((await api.getReservationByInviteCode("abcdefgh")).id, 7);
});

test("creates a reservation and maps the row", async () => {
  const { api, inserts } = setup();
  const result = await api.reserveSeat(input);
  assert.equal(result.ok, true);
  assert.ok(Number.isSafeInteger(result.reservation.id) && result.reservation.id > 0);
  assert.equal(result.invitePath, `/invite/${result.reservation.inviteCode}`);
  assert.equal((await api.getReservationById(result.reservation.id)).seat, 1);
  assert.equal(inserts.length, 1);
});

test("occupied seats return conflict without inserting", async () => {
  const { api, inserts } = setup([legacy]);
  const result = await api.reserveSeat(input);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.availability.occupiedSeats, 1);
  assert.equal(inserts.length, 0);
});

test("a seat unique violation at insert time becomes a conflict", async () => {
  const { api } = setup([], {
    async query(text) {
      if (text.includes("INSERT")) throw Object.assign(new Error("dup"), { code: "23505", constraint: "reservations_table_name_seat_key" });
      return { rows: [] };
    },
  });
  const result = await api.reserveSeat(input);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
});

test("simultaneous requests cannot claim the same seat", async () => {
  const { api, rows } = setup();
  const results = await Promise.all([api.reserveSeat(input), api.reserveSeat(input)]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => r.conflict).length, 1);
  assert.equal(rows.length, 1);
});

test("release frees only the matching seat", async () => {
  const { api, rows } = setup([legacy, { ...legacy, id: 8, seat: 2, inviteCode: "ZZZZZZZZ" }]);
  assert.equal(await api.releaseSeat(7), true);
  assert.equal(rows.length, 1);
  assert.equal(await api.releaseSeat(7), false);
});

test("newest reservations sort first", async () => {
  const { api } = setup([legacy, { ...legacy, id: 2, seat: 2, inviteCode: "ZZZZZZZZ", createdAt: "2026-02-01T00:00:00.000Z" }]);
  assert.equal((await api.listReservations())[0].id, 2);
});

test("database failures are not mistaken for an available seat", async () => {
  const failure = new Error("Database unavailable");
  const { api } = setup([], { async query() { throw failure; } });
  await assert.rejects(api.isSeatAvailable("Table 1", 1), (error) => error === failure);
});
