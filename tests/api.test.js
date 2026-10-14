/**
 * Integration tests for POST /api/registrations against a REAL MongoDB.
 *
 * Resolution order for the database:
 *   1. TEST_MONGODB_URI env var (e.g. your local mongod) — recommended
 *   2. mongodb-memory-server (devDependency) — a real mongod binary on a
 *      scratch port, data discarded afterwards
 *   3. If neither is possible, every test skips with a clear explanation.
 *
 * Run with:  npm test
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

// Generous limit for the test run: all requests come from 127.0.0.1.
process.env.RATE_LIMIT_MAX ??= "500";

let mongod = null;
let uri = process.env.TEST_MONGODB_URI || null;

if (!uri) {
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  } catch (err) {
    uri = null;
    console.warn(
      "\n  [!] No MongoDB available for integration tests.\n" +
        "      Install dependencies (npm install) or point TEST_MONGODB_URI\n" +
        "      at a running mongod. Cause: " + err.message + "\n"
    );
  }
}

let server = null;
let base = "";
let mongooseRef = null;
let Registration = null;

if (uri) {
  process.env.MONGODB_URI = uri;
  mongooseRef = (await import("mongoose")).default;
  const { connectDB } = await import("../src/config/db.js");
  await connectDB(uri);
  ({ Registration } = await import("../src/models/Registration.js"));
  // Wait until the unique indexes are built so duplicate tests are reliable.
  await Registration.init();

  const { createApp } = await import("../src/app.js");
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
}

function requireMongo(t) {
  if (!uri) {
    t.skip("MongoDB unavailable — see the warning printed above.");
    return true;
  }
  return false;
}

async function post(payload, { raw = false } = {}) {
  const res = await fetch(`${base}/api/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? payload : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const student = (overrides = {}) => ({
  name: "Ananya Sharma",
  sapId: "500123456",
  phone: "9876543210",
  collegeEmail: "ananya@college.edu",
  ...overrides,
});

before(async () => {
  if (Registration) await Registration.deleteMany({});
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongooseRef) await mongooseRef.disconnect().catch(() => {});
  if (mongod) await mongod.stop();
});

// ---------------------------------------------------------------------------
test("health endpoint reports API + database status", async (t) => {
  if (requireMongo(t)) return;
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.db, "up");
  assert.equal(body.service, "dronetech-api");
});

test("(1) valid registration is saved (201) with reference, normalized email; unknown fields dropped", async (t) => {
  if (requireMongo(t)) return;
  const dirty = student({
    name: "  Ananya   Sharma ",
    collegeEmail: "  ANANYA@College.EDU ",
    role: "admin", // mass-assignment attempt
    __proto__: { polluted: true },
  });
  const { status, body } = await post(dirty);
  assert.equal(status, 201);
  assert.equal(body.ok, true);
  assert.match(body.data.reference, /^DRN-[0-9A-F]{8}$/);
  assert.ok(!("_id" in body.data), "internal id must not be exposed");

  const doc = await Registration.findOne({ sapId: "500123456" }).lean();
  assert.ok(doc, "record must exist in MongoDB");
  assert.equal(doc.name, "Ananya Sharma");
  assert.equal(doc.collegeEmail, "ananya@college.edu");
  assert.equal(doc.role, undefined);
  assert.equal(doc.polluted, undefined);
  assert.ok(doc.createdAt instanceof Date);
  assert.equal({}.polluted, undefined);
});

test("(2) empty fields are rejected (400, one error per field)", async (t) => {
  if (requireMongo(t)) return;
  const { status, body } = await post({});
  assert.equal(status, 400);
  assert.equal(body.ok, false);
  for (const field of ["name", "sapId", "phone", "collegeEmail"]) {
    assert.ok(body.errors[field], `expected error for ${field}`);
  }
});

test("(3)(4) names with digits or punctuation are rejected", async (t) => {
  if (requireMongo(t)) return;
  for (const name of ["Ana123", "O'Brien", "Anne-Marie"]) {
    const { status, body } = await post(student({ name }));
    assert.equal(status, 400);
    assert.match(body.errors.name, /letters and spaces/);
  }
});

test("(5)(6)(7) SAP ID: 8 and 10 digits rejected, 9 accepted", async (t) => {
  if (requireMongo(t)) return;
  for (const sapId of ["12345678", "1234567890"]) {
    const { status, body } = await post(student({ sapId }));
    assert.equal(status, 400);
    assert.match(body.errors.sapId, /exactly 9 digits/);
  }
  const ok = await post(
    student({ name: "Neha Patel", sapId: "500987654", phone: "8876543210", collegeEmail: "neha@college.edu" })
  );
  assert.equal(ok.status, 201);
});

test("(8)(9)(10) phone: wrong prefix/length rejected; 7/8/9 prefixes accepted", async (t) => {
  if (requireMongo(t)) return;
  for (const phone of ["6123456789", "987654321", "98765432100", "+919876543210"]) {
    const { status, body } = await post(student({ phone }));
    assert.equal(status, 400);
    assert.ok(body.errors.phone, `expected phone error for ${phone}`);
  }
  const words = ["One", "Two", "Three"];
  for (const [i, phone] of ["7876500001", "8876500002", "9876500003"].entries()) {
    const res = await post(
      student({
        name: `Test User${words[i]}`,
        sapId: `60000000${i + 1}`,
        phone,
        collegeEmail: `tester${i}@college.edu`,
      })
    );
    assert.equal(res.status, 201);
  }
});

test("(11) malformed emails are rejected", async (t) => {
  if (requireMongo(t)) return;
  for (const collegeEmail of ["student@", "@college.edu", "student college.edu", "student@college"]) {
    const { status, body } = await post(student({ collegeEmail }));
    assert.equal(status, 400);
    assert.ok(body.errors.collegeEmail, `expected email error for ${collegeEmail}`);
  }
});

test("(12)(13) duplicate SAP ID, email and phone return 409 with the field identified", async (t) => {
  if (requireMongo(t)) return;
  const dupSap = await post(
    student({ name: "Copy Cat", phone: "7778889990", collegeEmail: "copy@college.edu" })
  );
  assert.equal(dupSap.status, 409);
  assert.match(dupSap.body.errors.sapId, /already registered/);

  const dupEmail = await post(
    student({ name: "Copy Cat", sapId: "700000001", phone: "7778889990" })
  );
  assert.equal(dupEmail.status, 409);
  assert.match(dupEmail.body.errors.collegeEmail, /already registered/);

  const dupPhone = await post(
    student({ name: "Copy Cat", sapId: "700000002", collegeEmail: "copy2@college.edu" })
  );
  assert.equal(dupPhone.status, 409);
  assert.match(dupPhone.body.errors.phone, /already registered/);
});

test("concurrent identical submissions: exactly one succeeds (unique indexes, not check-then-insert)", async (t) => {
  if (requireMongo(t)) return;
  const payload = student({ name: "Race Winner", sapId: "800000001", phone: "9111111111", collegeEmail: "race@college.edu" });
  const results = await Promise.all([post(payload), post(payload)]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
});

test("malformed JSON and wrong shapes get clean 400s", async (t) => {
  if (requireMongo(t)) return;
  const bad = await post("{not json", { raw: true });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /valid JSON/);

  const arr = await post([]);
  assert.equal(arr.status, 400);
});

test("unknown API paths get a JSON 404", async (t) => {
  if (requireMongo(t)) return;
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).ok, false);
});

test("(14) database failure produces 500 — never a false success", async (t) => {
  if (requireMongo(t)) return;
  await mongooseRef.disconnect(); // simulate an outage
  const res = await post(student({ name: "Outage Test", sapId: "900000001", phone: "9000000001", collegeEmail: "outage@college.edu" }));
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  assert.notEqual(res.status, 201, "must never report success without a save");

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 503);

  await mongooseRef.connect(uri); // restore for a clean shutdown
});
