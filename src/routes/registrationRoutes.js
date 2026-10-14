import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createRegistration } from "../controllers/registrationController.js";

/**
 * POST /api/registrations — create a student registration.
 *
 * Rate limited per IP to slow down scripted abuse. Configurable through
 * RATE_LIMIT_MAX; generous by default so live demos never hit the ceiling.
 */
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
});

const router = Router();

router.post("/", registrationLimiter, createRegistration);

export default router;
