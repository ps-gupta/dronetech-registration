import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import registrationRoutes from "./routes/registrationRoutes.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * Builds the Express application. Kept separate from server.js so tests can
 * mount the app without opening a real port or connecting to MongoDB first.
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  // Sensible security headers, including a strict CSP: this app only uses
  // self-hosted CSS/JS/fonts, so nothing external is allowed by default.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "img-src": ["'self'", "data:"], // data: for the inline SVG favicon
          "font-src": ["'self'"],
          "connect-src": ["'self'"],
          // The app runs on http://localhost during development; upgrading
          // subresource requests to https would break local usage.
          "upgrade-insecure-requests": null,
        },
      },
    })
  );

  // Parse JSON bodies only, capped at 10kb (a registration is tiny).
  app.use(express.json({ limit: "10kb" }));

  // CORS: the frontend is served by this same app, so none is needed by
  // default. Enable it explicitly via CLIENT_ORIGIN for split hosting.
  if (process.env.CLIENT_ORIGIN) {
    app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
  }

  // --- API -------------------------------------------------------------
  app.get("/api/health", (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    const payload = {
      service: "dronetech-api",
      db: dbUp ? "up" : "down",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res
      .status(dbUp ? 200 : 503)
      .set("Cache-Control", "no-store")
      .json({ ok: dbUp, ...payload });
  });

  app.use("/api/registrations", registrationRoutes);

  // Unknown API endpoints get a clean JSON 404.
  app.use("/api", apiNotFound);

  // --- Static frontend (same origin -> no CORS needed) -----------------
  app.use(express.static(PUBLIC_DIR, { index: "index.html", maxAge: "1h" }));

  // Anything else: consistent 404.
  app.use(apiNotFound);

  // Central error handler (last by definition).
  app.use(errorHandler);

  return app;
}
