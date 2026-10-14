/**
 * Unit tests for the shared registration rules. No database required —
 * these run anywhere:  node --test tests/validation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeRegistration,
  validateRegistration,
} from "../src/validators/registrationValidator.js";

const VALID = {
  name: "Ananya Sharma",
  sapId: "500123456",
  phone: "9876543210",
  collegeEmail: "ananya@college.edu",
};

const run = (overrides = {}) =>
  validateRegistration(sanitizeRegistration({ ...VALID, ...overrides }));

// --- name ----------------------------------------------------------------
test("name: names with digits are rejected", () => {
  assert.match(run({ name: "Ana123" }).name, /letters and spaces/);
});

test("name: prohibited punctuation is rejected", () => {
  assert.match(run({ name: "O'Brien" }).name, /letters and spaces/);
  assert.match(run({ name: "Anne-Marie!" }).name, /letters and spaces/);
});

test("name: empty and whitespace-only values are rejected", () => {
  assert.match(run({ name: "   " }).name, /required/);
});

test("name: unicode alphabetic names and multiple words are accepted", () => {
  assert.deepEqual(run({ name: "José María López" }), {});
  assert.deepEqual(run({ name: "Андрій Шевченко" }), {});
  assert.deepEqual(run({ name: "Priya Rani Patel" }), {});
});

test("name: surrounding whitespace is trimmed, inner spaces collapsed", () => {
  const clean = sanitizeRegistration({ ...VALID, name: "  Ananya   Sharma  " });
  assert.equal(clean.name, "Ananya Sharma");
});

// --- sapId ---------------------------------------------------------------
test("sapId: 8 digits rejected, 10 digits rejected, 9 digits accepted", () => {
  assert.match(run({ sapId: "12345678" }).sapId, /exactly 9 digits/);
  assert.match(run({ sapId: "1234567890" }).sapId, /exactly 9 digits/);
  assert.deepEqual(run({ sapId: "123456789" }), {});
});

test("sapId: letters and spaces rejected; string preserved (leading zero)", () => {
  assert.match(run({ sapId: "50012a456" }).sapId, /exactly 9 digits/);
  const clean = sanitizeRegistration({ ...VALID, sapId: "050012345" });
  assert.equal(clean.sapId, "050012345");
  assert.equal(typeof clean.sapId, "string");
});

// --- phone ---------------------------------------------------------------
test("phone: must be 10 digits starting with 9, 8 or 7", () => {
  assert.match(run({ phone: "6123456789" }).phone, /start with 9, 8, or 7/);
  assert.match(run({ phone: "987654321" }).phone, /10 digits/);
  assert.match(run({ phone: "+919876543210" }).phone, /10 digits/);
  assert.deepEqual(run({ phone: "7876543210" }), {});
  assert.deepEqual(run({ phone: "8876543210" }), {});
  assert.deepEqual(run({ phone: "9876543210" }), {});
});

// --- collegeEmail --------------------------------------------------------
test("collegeEmail: malformed addresses are rejected", () => {
  const bad = ["student@", "@college.edu", "student college.edu", "student@college", "stu@college."];
  for (const collegeEmail of bad) {
    assert.ok(run({ collegeEmail }).collegeEmail, `expected '${collegeEmail}' to fail`);
  }
});

test("collegeEmail: valid forms accepted; trimmed and lowercased", () => {
  const clean = sanitizeRegistration({ ...VALID, collegeEmail: "  Stu.Dent@University.AC.in " });
  assert.equal(clean.collegeEmail, "stu.dent@university.ac.in");
  assert.deepEqual(run({ collegeEmail: "Student@College.EDU" }), {});
});

// --- normalization / mass assignment --------------------------------------
test("unknown fields are dropped (mass-assignment protection)", () => {
  const clean = sanitizeRegistration({
    ...VALID,
    role: "admin",
    isVerified: true,
    __proto__: { polluted: true },
  });
  assert.deepEqual(Object.keys(clean).sort(), [
    "collegeEmail",
    "name",
    "phone",
    "sapId",
  ]);
  assert.equal({}.polluted, undefined); // prototype pollution not propagated
});

test("non-object bodies produce four 'required' errors", () => {
  assert.deepEqual(Object.keys(validateRegistration(sanitizeRegistration(null))).sort(), [
    "collegeEmail",
    "name",
    "phone",
    "sapId",
  ]);
});

test("a fully valid payload passes", () => {
  assert.deepEqual(run(), {});
});
