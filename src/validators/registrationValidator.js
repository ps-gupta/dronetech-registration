/**
 * Registration input rules — the single source of truth, shared by the
 * controller and reused by the Mongoose schema. The exact same rules run in
 * the browser (public/js/app.js), so client and server always agree.
 */

/** Alphabetic names in any Unicode script; words separated by spaces. */
export const NAME_RE = /^\p{L}+(?:\s+\p{L}+)*$/u;
export const SAP_ID_RE = /^[0-9]{9}$/;
export const PHONE_RE = /^[987][0-9]{9}$/;
/** Reasonable email check: non-empty local part + dotted domain with TLD. */
export const EMAIL_RE =
  /^[^\s@]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** The only fields this API accepts (mass-assignment protection). */
export const ALLOWED_FIELDS = ["name", "sapId", "phone", "collegeEmail"];

/**
 * Whitelists the four accepted fields and normalizes them:
 *  - name: trimmed, internal whitespace collapsed to single spaces
 *  - sapId / phone: trimmed (kept as strings, never coerced to numbers)
 *  - collegeEmail: trimmed and lowercased
 */
export function sanitizeRegistration(raw) {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const pick = (value) => (typeof value === "string" ? value : "");

  return {
    name: pick(source.name).trim().replace(/\s+/g, " "),
    sapId: pick(source.sapId).trim(),
    phone: pick(source.phone).trim(),
    collegeEmail: pick(source.collegeEmail).trim().toLowerCase(),
  };
}

/**
 * Validates every field independently.
 * Returns { [field]: message } — an empty object means "valid".
 */
export function validateRegistration(input) {
  const errors = {};

  if (!input.name) {
    errors.name = "Full name is required.";
  } else if (input.name.length < 2) {
    errors.name = "Please enter your full name (at least 2 letters).";
  } else if (input.name.length > 80) {
    errors.name = "Please keep the name under 80 characters.";
  } else if (!NAME_RE.test(input.name)) {
    errors.name = "Name may contain letters and spaces only.";
  }

  if (!input.sapId) {
    errors.sapId = "SAP ID is required.";
  } else if (!SAP_ID_RE.test(input.sapId)) {
    errors.sapId = "SAP ID must contain exactly 9 digits.";
  }

  if (!input.phone) {
    errors.phone = "Phone number is required.";
  } else if (!PHONE_RE.test(input.phone)) {
    errors.phone = "Phone number must be 10 digits and start with 9, 8, or 7.";
  }

  if (!input.collegeEmail) {
    errors.collegeEmail = "College email is required.";
  } else if (
    input.collegeEmail.length > 254 ||
    !EMAIL_RE.test(input.collegeEmail)
  ) {
    errors.collegeEmail =
      "Enter a valid email address (e.g., student@college.edu).";
  }

  return errors;
}
