# Dronetech — Student Registration Portal

A full-stack student registration website built with **HTML5, CSS3 and vanilla
JavaScript** on the frontend, and **Node.js + Express + MongoDB (Mongoose)**
on the backend. The portal is validated on **both** sides, persists every
registration in MongoDB, rejects duplicates with database-enforced unique
indexes, and ships with an automated test suite.

The interface is a dark, technology-inspired registration card — **Dronetech /
Student Registration Portal** — with cursor-responsive effects (glow follow,
restrained 3D card tilt, parallax, and an ambient particle "drone swarm")
that automatically degrade for touch devices and `prefers-reduced-motion`.

---

## Features

- Registration form with exactly four fields: **Full Name, SAP ID, Phone
  Number, College Email**.
- Instant, accessible client validation (on blur / while correcting / on
  submit) with per-field messages, `aria-invalid`, `aria-describedby` and a
  live status region.
- Server re-validates every field independently — the client is only a
  convenience layer.
- **Normalization**: names trimmed with collapsed whitespace, emails trimmed +
  lowercased, IDs kept as strings.
- **Duplicate prevention** enforced by MongoDB unique indexes on `sapId`,
  `collegeEmail`, `phone` (and internal `reference`) — safe even under
  simultaneous submissions; verified by an automated concurrency test.
- Polished states: loading ("Submitting registration…"), animated success
  panel with a public registration reference (`DRN-XXXXXXXX`), duplicate /
  validation / network error banners.
- Security: Helmet with a strict Content-Security-Policy, 10 kb JSON body
  limit, rate limiting, field whitelisting (no mass assignment), sanitized
  error responses, no credential or payload logging.
- `GET /api/health` reports API + database status without leaking details.
- Self-contained: fonts are bundled locally, no external CDN or paid service
  is required at runtime.

## Validation Rules

| Field | Type | Rule | Example message |
| --- | --- | --- | --- |
| Full Name | string | required, Unicode letters + spaces only, 2–80 chars | `Name may contain letters and spaces only.` |
| SAP ID | string | required, exactly `^[0-9]{9}$` | `SAP ID must contain exactly 9 digits.` |
| Phone Number | string | required, exactly `^[987][0-9]{9}$` | `Phone number must be 10 digits and start with 9, 8, or 7.` |
| College Email | string | required, trimmed + lowercased, local part + `@` + dotted domain with TLD | `Enter a valid email address (e.g., student@college.edu).` |

The exact same rules run in the browser (`public/js/app.js`) and on the
server (`src/validators/registrationValidator.js`), so both layers always
agree.

## Technology Stack

| Layer | Tech |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript (Fetch API), SVG/CSS graphics |
| Backend | Node.js, Express 4 |
| Database | MongoDB via Mongoose 8 |
| Security | helmet, cors (opt-in), express-rate-limit |
| Config | dotenv |
| Tests | Node built-in test runner (`node --test`) |
| Dev tooling | nodemon, mongodb-memory-server (optional local Mongo helper) |

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI[index.html + style.css + app.js]
    end
    subgraph "Express server (src/)"
        APP[app.js<br/>helmet · JSON 10kb · static]
        RL[rate limiter]
        RT[routes/registrationRoutes]
        CT[controllers/registrationController]
        VA[validators/registrationValidator]
        MD[models/Registration]
        EH[middleware/errorHandler]
    end
    DB[(MongoDB<br/>unique indexes:<br/>sapId · collegeEmail · phone)]

    UI -->|POST /api/registrations (fetch, JSON)| APP --> RL --> RT --> CT
    CT --> VA -- errors --> CT
    CT --> MD --> DB
    DB -- E11000 duplicate --> CT
    CT -- 201 / 400 / 409 --> UI
    APP -- any thrown error --> EH -- 500 sanitized --> UI
```

## Project Structure

```
dronetech-registration/
├── public/                     # frontend (served by Express, same origin)
│   ├── index.html              # Dronetech registration page
│   ├── css/style.css           # design system + animations
│   ├── js/app.js               # validation, submission, cursor FX
│   └── assets/fonts/           # self-hosted woff2 fonts
├── src/
│   ├── config/db.js            # Mongoose connection (credentials never logged)
│   ├── models/Registration.js  # schema + validators + unique indexes
│   ├── routes/registrationRoutes.js      # POST /api/registrations + rate limit
│   ├── controllers/registrationController.js
│   ├── middleware/errorHandler.js        # JSON 404 + sanitized 500s
│   ├── validators/registrationValidator.js  # shared rules (source of truth)
│   ├── app.js                  # Express app assembly (no listener)
│   └── server.js               # bootstrap: DB first, then HTTP
├── scripts/dev-mongo.js        # optional local mongod helper (persistent)
├── tests/
│   ├── validation.test.js      # pure unit tests (no DB needed)
│   └── api.test.js             # integration tests against real MongoDB
├── .env.example                # configuration template (no secrets)
├── .gitignore
└── package.json
```

## Prerequisites

- **Node.js ≥ 18.17** (includes `fetch` and `node --test`).
- **MongoDB** running locally or reachable over the network. You have options:
  1. **Install MongoDB Community Server** (recommended)
     - Windows: download the MSI from mongodb.com/try/download/community or
       `winget install MongoDB.Server`. It installs as a Windows service and
       listens on `mongodb://127.0.0.1:27017` automatically.
     - macOS: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
     - Ubuntu/Debian: follow "Install MongoDB Community Edition" in the
       official docs, then `sudo systemctl start mongod`.
  2. **No-install convenience**: `npm run dev:atlas` starts a real local
     `mongod` (managed by `mongodb-memory-server`) with disk persistence under
     `./data/mongo`, and prints the `MONGODB_URI` line to paste into `.env`.
     Keep that terminal open while you work.
  3. A free MongoDB **Atlas** cluster — use its `mongodb+srv://…` URI.

If MongoDB is down, the server **fails fast at startup** with a clear
message — it never fakes a save.

## Setup & Startup (Windows PowerShell, macOS, Linux)

```powershell
# 1. enter the project folder
cd dronetech-registration

# 2. install dependencies
npm install

# 3. create your environment file from the template
Copy-Item .env.example .env        # PowerShell
# cp .env.example .env             # macOS / Linux

# 4. edit .env if your MongoDB URI differs from the local default
#    MONGODB_URI=mongodb://127.0.0.1:27017/dronetech

# 5. start the server
npm start          # production-style: node src/server.js
# npm run dev      # development: nodemon with auto-restart
```

Then open **http://localhost:3000** in your browser.

## Verifying the Backend

### Health check

```powershell
Invoke-RestMethod http://localhost:3000/api/health
# curl http://localhost:3000/api/health     (macOS/Linux, or curl.exe on Windows)
```

Healthy response (`503` when the database is unreachable):

```json
{ "ok": true, "service": "dronetech-api", "db": "up", "uptimeSeconds": 42, "timestamp": "2026-01-01T10:00:00.000Z" }
```

### Register a student (API example)

```bash
curl -X POST http://localhost:3000/api/registrations \
  -H "Content-Type: application/json" \
  -d '{"name":"Ananya Sharma","sapId":"500123456","phone":"9876543210","collegeEmail":"ananya@college.edu"}'
```

PowerShell 5.1 (no curl alias):

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/registrations `
  -ContentType "application/json" `
  -Body '{"name":"Ananya Sharma","sapId":"500123456","phone":"9876543210","collegeEmail":"ananya@college.edu"}'
```

**201 Created**

```json
{ "ok": true, "message": "Registration successful.", "data": { "name": "Ananya Sharma", "reference": "DRN-9F3AC21E" } }
```

**400 Bad Request** (invalid input — per-field messages)

```json
{
  "ok": false,
  "message": "Please correct the highlighted fields and try again.",
  "errors": {
    "name": "Name may contain letters and spaces only.",
    "sapId": "SAP ID must contain exactly 9 digits.",
    "phone": "Phone number must be 10 digits and start with 9, 8, or 7.",
    "collegeEmail": "Enter a valid email address (e.g., student@college.edu)."
  }
}
```

**409 Conflict** (duplicate identifier — the conflicting field is named)

```json
{ "ok": false, "message": "A registration with these details already exists.", "errors": { "sapId": "This SAP ID is already registered." } }
```

**429 Too Many Requests** · **500 Internal Server Error** — consistent `{ ok, message }` shape; internals and stack traces are never sent to the client.

### Confirm a record in MongoDB

```powershell
mongosh "mongodb://127.0.0.1:27017/dronetech" --eval "db.registrations.find({}, {reference:1, name:1, sapId:1})"
```

Records survive server restarts (verified by an automated/manual restart
test) — there is no in-memory fallback storage anywhere.

## How Duplicates Are Handled

`sapId`, `collegeEmail` and `phone` are declared **unique registration
identifiers** (phone included: one phone number = one student, documented
here as a product decision — drop the `phone` index in
`src/models/Registration.js` if your event allows shared numbers).

Uniqueness is enforced by **MongoDB unique indexes**, not by querying before
insert. Two simultaneous identical submissions result in exactly one `201`
and one `409` — proven by the `concurrent identical submissions` test.
Mongoose surfaces the violation as `E11000`, which the controller maps to a
`409 Conflict` naming the offending field.

## Testing

```powershell
npm test
```

Runs two suites with the built-in Node test runner (no install beyond
`npm install`):

- `tests/validation.test.js` — pure unit tests of every rule, including
  Unicode names, whitespace handling, mass-assignment protection.
- `tests/api.test.js` — boots the real app against a real MongoDB and covers:
  valid save + DB inspection, empty fields, digit/punctuation names, 8- and
  10-digit SAP IDs, wrong phone prefixes/lengths, malformed emails, duplicate
  SAP ID/email/phone, a concurrency race, malformed JSON, 404 handling, and a
  **simulated database outage returning 500 (never a false success)**.

The integration suite uses, in order: `TEST_MONGODB_URI` (your own mongod),
or the bundled `mongodb-memory-server` binary. If neither is available it
skips with an explanation rather than failing silently:

```powershell
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017/dronetech-test"; npm test
```

Manual UI checks worth doing for a demo: desktop + mobile widths, keyboard
tab order (visible cyan focus rings), and Windows Settings → Ease of Access →
"Show animations" off (the portal honors `prefers-reduced-motion`).

## Security Notes

- Secrets live in `.env` only; `.env` is git-ignored; `.env.example` ships
  placeholders.
- Helmet sets security headers incl. a strict CSP (`default-src 'self'`).
- `express.json({ limit: "10kb" })`; per-IP rate limit
  (`RATE_LIMIT_MAX`, default 30 / 15 min) on the registration endpoint.
- Only the four whitelisted fields are read from the body (no mass
  assignment); all queries are parameterized through Mongoose.
- Errors are logged server-side with codes/references only — never full
  names, phones or emails; clients always receive sanitized JSON.
- CORS is **off** by default because Express serves the frontend from the
  same origin; enable with `CLIENT_ORIGIN` only if you host the UI elsewhere.

## Known Limitations

- The rate limiter is in-memory: it resets on restart and is per-process
  (single instance). Use a shared store (e.g. Redis) for multi-instance
  deployments.
- Email validation is **format-only**. No ownership verification is claimed;
  wire a real confirmation workflow (token + mail provider) if you need it.
- No authentication or admin UI — intentionally out of scope for this brief.
- `GET /api/registrations` intentionally returns `405`; there is no listing
  endpoint, so registrations cannot be enumerated through the API.
