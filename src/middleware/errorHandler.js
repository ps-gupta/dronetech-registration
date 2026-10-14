/**
 * Central error handling. Clients always receive a consistent, sanitized
 * JSON shape — never stack traces, driver messages, or internal details.
 */

export function apiNotFound(req, res) {
  res.status(404).json({ ok: false, message: "Resource not found." });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export function errorHandler(err, req, res, next) {
  // Body-parser errors arrive with a `type` property.
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ ok: false, message: "Request body must be valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res
      .status(413)
      .json({ ok: false, message: "Request payload is too large." });
  }

  // Unexpected failure: log the detail server-side, answer generically.
  console.error("[error] Unhandled:", err.message);
  return res.status(500).json({
    ok: false,
    message: "Something went wrong on our side. Please try again later.",
  });
}
