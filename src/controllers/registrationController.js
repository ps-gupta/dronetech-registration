import crypto from "node:crypto";
import { Registration } from "../models/Registration.js";
import {
  sanitizeRegistration,
  validateRegistration,
} from "../validators/registrationValidator.js";

const DUPLICATE_MESSAGES = {
  sapId: "This SAP ID is already registered.",
  collegeEmail: "This email address is already registered.",
  phone: "This phone number is already registered.",
};

/** Public, non-guessable reference — internal _id stays private. */
function generateReference() {
  return `DRN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createRegistration(req, res, next) {
  try {
    // 1. Whitelist accepted fields + normalize (mass-assignment protection).
    const input = sanitizeRegistration(req.body);

    // 2. Validate all fields independently on the server.
    const errors = validateRegistration(input);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Please correct the highlighted fields and try again.",
        errors,
      });
    }

    // 3. Persist. Unique indexes reject duplicates atomically; a reference
    //    collision is astronomically unlikely, but retry once just in case.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reference = generateReference();
      try {
        await Registration.create({ ...input, reference });
        // Log only the public reference — never personal identifiers.
        console.log(`[registrations] created ref=${reference}`);
        return res.status(201).json({
          ok: true,
          message: "Registration successful.",
          data: { name: input.name, reference },
        });
      } catch (err) {
        // MongoDB duplicate key (E11000) -> 409 Conflict
        if (err && err.code === 11000) {
          const field = Object.keys(err.keyValue || {})[0];
          if (field === "reference") continue; // retry once with a new ref
          return res.status(409).json({
            ok: false,
            message: "A registration with these details already exists.",
            errors: DUPLICATE_MESSAGES[field]
              ? { [field]: DUPLICATE_MESSAGES[field] }
              : {},
          });
        }
        // Mongoose schema validation (belt & braces) -> 400
        if (err && err.name === "ValidationError") {
          const fieldErrors = {};
          for (const [field, detail] of Object.entries(err.errors)) {
            fieldErrors[field] = detail.message;
          }
          return res.status(400).json({
            ok: false,
            message: "Please correct the highlighted fields and try again.",
            errors: fieldErrors,
          });
        }
        throw err; // anything unexpected goes to the central error handler
      }
    }

    return res.status(500).json({
      ok: false,
      message: "Could not complete the registration. Please retry.",
    });
  } catch (err) {
    next(err);
  }
}
