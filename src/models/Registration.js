import mongoose from "mongoose";
import {
  EMAIL_RE,
  NAME_RE,
  PHONE_RE,
  SAP_ID_RE,
} from "../validators/registrationValidator.js";

/**
 * A stored student registration.
 *
 * Uniqueness of SAP ID, college email and phone is enforced at the DATABASE
 * level with unique indexes (not by "check-then-insert"), so duplicates are
 * rejected even when two identical requests arrive simultaneously.
 */
const registrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Full name is required."],
    trim: true,
    minlength: [2, "Please enter your full name (at least 2 letters)."],
    maxlength: [80, "Please keep the name under 80 characters."],
    match: [NAME_RE, "Name may contain letters and spaces only."],
  },
  sapId: {
    type: String, // deliberately a string: leading zeros, exactly 9 digits
    required: [true, "SAP ID is required."],
    match: [SAP_ID_RE, "SAP ID must contain exactly 9 digits."],
  },
  phone: {
    type: String,
    required: [true, "Phone number is required."],
    match: [PHONE_RE, "Phone number must be 10 digits and start with 9, 8, or 7."],
  },
  collegeEmail: {
    type: String,
    required: [true, "College email is required."],
    trim: true,
    lowercase: true, // normalized before storage
    maxlength: 254,
    match: [EMAIL_RE, "Enter a valid email address (e.g., student@college.edu)."],
  },
  reference: {
    type: String,
    required: true,
    immutable: true, // public reference shown after success (never the _id)
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

registrationSchema.index({ sapId: 1 }, { unique: true, name: "uniq_sap_id" });
registrationSchema.index(
  { collegeEmail: 1 },
  { unique: true, name: "uniq_college_email" }
);
registrationSchema.index({ phone: 1 }, { unique: true, name: "uniq_phone" });
registrationSchema.index(
  { reference: 1 },
  { unique: true, name: "uniq_reference" }
);

export const Registration = mongoose.model("Registration", registrationSchema);
