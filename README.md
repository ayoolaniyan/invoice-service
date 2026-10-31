# Invoice Service

A REST API for managing companies and their invoices, built with Node.js, Express 5, TypeScript, Mongoose and MongoDB.

Invoices belong to a company and move through a set of statuses (`draft`, `pending`, `paid`, `overdue`, `cancelled`). Every request is validated, and every response uses the same JSON format.

## Tech stack

- **Runtime:** Node.js, TypeScript
- **Web framework:** Express 5
- **Database:** MongoDB with Mongoose
- **Validation:** express-validator
- **Dependency injection:** InversifyJS
- **API docs:** Swagger (swagger-jsdoc + swagger-ui-express)

## Getting started

### Requirements

- Node.js 18 or later (developed on Node 22)
- A MongoDB instance, either local or hosted (e.g. MongoDB Atlas)

### Setup

```bash
npm install
```

Generate an API key (see [Authentication](#authentication)):

```bash
npm run api-key:generate -- local-dev write
```

Create a `.env` file in the project root:

```env
DATABASE_CONNECTION_STRING=mongodb://127.0.0.1:27017
DATABASE_NAME=invoice_service
PORT=3001
API_KEYS=local-dev:write:<hash printed by api-key:generate>
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_CONNECTION_STRING` | Yes | | MongoDB connection URI |
| `DATABASE_NAME` | Yes | | Database to use |
| `PORT` | Yes | | Port the HTTP server listens on |
| `API_KEYS` | Yes | | Comma-separated `name:role:sha256-hash` entries, one per client |
| `CORS_ORIGINS` | No | none | Comma-separated browser origins allowed to call the API, e.g. `https://app.example.com`. With none set, browsers can't call it from other sites; server-to-server calls aren't affected |
| `RATE_LIMIT_MAX` | No | `300` | Requests allowed per client IP per window |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate limit window in milliseconds |
| `TRUST_PROXY` | No | off | Number of proxies (load balancer, ingress) in front of the app, so rate limiting sees real client IPs. Leave unset if clients connect directly |
| `NODE_ENV` | No | | Set to `production` in production. This turns off the Swagger UI |
| `ENABLE_API_DOCS` | No | on unless `NODE_ENV=production` | `true` or `false` to force the Swagger UI on or off |

The app exits on startup if a required variable is missing or `API_KEYS` is malformed. `.env` is git-ignored, so never commit real credentials.

### Run

```bash
# Development, with reload on change
npm run start:dev

# Production
npm run build
npm start
```

Once it's running:

- API: `http://localhost:<PORT>/api/v1`
- Swagger UI: `http://localhost:<PORT>/api-docs` (outside production). Click **Authorize** and enter your API key to try requests.

## API

All endpoints are under `/api/v1`. Full request and response schemas are in the Swagger UI.

### Authentication

Every request to `/api/v1` needs an API key in the `X-API-Key` header:

```bash
curl http://localhost:3001/api/v1/invoices -H "X-API-Key: <your key>"
```

Each key has a role:

| Role | Can use |
|---|---|
| `read` | `GET` endpoints only |
| `write` | All endpoints |

A missing or wrong key returns `401`. A `read` key on a `POST`, `PATCH` or `DELETE` returns `403`.

**Managing keys:**
- **Create:** `npm run api-key:generate -- <name> <read|write>` prints a new key and its `API_KEYS` entry. Give the key to the client and add the entry to `API_KEYS`.
- **Storage:** only the SHA-256 hash is stored, so a leaked config doesn't expose usable keys, and a lost key can't be recovered. Generate a new one instead.
- **Revoke:** remove the key's entry from `API_KEYS` and restart.
- **Rotate:** add the new entry, move the client over, then remove the old entry.

### Rate limiting

Each client IP can make `RATE_LIMIT_MAX` requests (default 300) per `RATE_LIMIT_WINDOW_MS` (default 15 minutes). This also applies to requests with a wrong key, which slows down key guessing.
- **Headers:** every response carries `RateLimit` and `RateLimit-Policy` headers.
- **Over the limit:** the API returns `429` with a `Retry-After` header.
- **Behind a load balancer or proxy:** set `TRUST_PROXY`. Otherwise every client shares the proxy's IP, and therefore one limit.

### Companies

| Method | Path | Description | Success |
|---|---|---|---|
| `POST` | `/companies` | Create a company | `201` + `Location` header |
| `GET` | `/companies` | List companies (paginated) | `200` |
| `GET` | `/companies/:id` | Get a company | `200` |
| `PATCH` | `/companies/:id` | Update some fields of a company | `200` |
| `DELETE` | `/companies/:id` | Delete a company | `204` |

`registrationNumber` is set when the company is created and can't be changed afterwards.

### Invoices

| Method | Path | Description | Success |
|---|---|---|---|
| `POST` | `/invoices` | Create an invoice | `201` + `Location` header |
| `GET` | `/invoices` | List invoices (paginated) | `200` |
| `GET` | `/invoices/:id` | Get an invoice | `200` |
| `PATCH` | `/invoices/:id` | Update some fields of an invoice | `200` |
| `DELETE` | `/invoices/:id` | Delete an invoice | `204` |

Rules:

- An invoice must reference an existing company through `companyId`. The company's name and registration number are copied onto the invoice by the server; values sent by the client are ignored.
- `dueDate` can't be before `issueDate`.
- `amount` is a whole number in the currency's **minor unit** (kobo, cents, etc.), so `15050` with `NGN` means ₦150.50. Decimals are rejected. This avoids floating-point rounding errors such as `0.1 + 0.2 = 0.30000000000000004`.
- `currency` is a required ISO 4217 code such as `NGN` or `USD`. Lower case is accepted and stored in upper case. To change it on an update, send `amount` in the same request, because the same number means a different value in another currency.
- Only invoices with status `paid`, `cancelled` or `draft` can be deleted. Deleting any other invoice returns `409 Conflict`.

Example: create an invoice

```bash
curl -X POST http://localhost:3001/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <write key>" \
  -d '{
    "invoiceNumber": "INV-001",
    "description": "Consulting, October",
    "issueDate": "2026-10-01",
    "dueDate": "2026-10-31",
    "status": "pending",
    "amount": 15050,
    "currency": "NGN",
    "companyId": "<company id>"
  }'
```

### Pagination

List endpoints accept these query parameters:

| Parameter | Default | Allowed values |
|---|---|---|
| `page` | `1` | Integer, 1 or more |
| `limit` | `10` | Integer from 1 to 100 |
| `order` | `asc` | `asc` or `desc`, sorted by creation date |

### Response format

Every JSON response is wrapped in the same envelope.

Success:

```json
{
  "status": "success",
  "statusCode": 200,
  "message": "OK",
  "data": [ ... ],
  "meta": { "total": 23, "page": 1, "limit": 10, "totalPages": 3 }
}
```

`meta` is only included on list responses.

Error:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Bad Request",
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "amount", "location": "body", "message": "Invoice amount must be a non-negative whole number in the currency's minor unit (e.g. 15050 for 150.50)" }
    ]
  }
}
```

| Status | When |
|---|---|
| `400` | Validation failed, malformed JSON, an invalid ID, or a list where a single value is expected (e.g. `?page=1&page=2`) |
| `401` | Missing or invalid API key |
| `403` | The API key's role doesn't allow this request |
| `404` | Resource or route not found |
| `409` | Conflict, e.g. a duplicate value or deleting an invoice whose status doesn't allow it |
| `413` | Request body larger than 100 KB |
| `429` | Rate limit exceeded |
| `500` | Unexpected error. Details are logged on the server, not returned to the client |

## Project structure

```
index.ts                  App setup and startup
scripts/                  One-off maintenance scripts
src/
  config/                 Dependency injection container, routes, Swagger, API keys, CORS
  controllers/            Read validated input from requests and call services
  errors/                 Typed errors (BadRequest, Unauthorized, Forbidden, NotFound, ...)
  middlewares/            Auth, rate limiting, request validation, response format, error handling
  models/                 Mongoose schemas and TypeScript interfaces
  routes/                 Express routers with their Swagger docs
  services/               Business logic and database access
  validators/             express-validator rules
```

A request goes through: security headers (helmet) → CORS → rate limiter → `authenticate` (API key) → router → `authorize` (role) → validators → `validateRequest` → controller → service → Mongoose model. Errors thrown anywhere in that chain are turned into a JSON response by the central error handler.

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with nodemon and ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled app |
| `npm run api-key:generate -- <name> <read\|write>` | Create an API key and its `API_KEYS` entry |
| `npm run migrate:backfill-company-id` | Set `companyId` on invoices created before it was stored |
| `npm run migrate:amounts-to-minor-units -- --currency NGN` | Convert decimal amounts on invoices created before currencies were stored (e.g. `150.5` → `15050`) and set their currency |

Notes on the migrations:

- Add `-- --dry-run` (or `--dry-run` after the other arguments) to see what would change without writing anything.
- Both are safe to run again: they only touch invoices that haven't been migrated yet.
- They never guess. Invoices they can't migrate are skipped and listed, and the script exits with code `2`.
  - `backfill-company-id` matches invoices to companies by registration number, and skips any invoice that doesn't match exactly one company.
  - `amounts-to-minor-units` skips any amount it can't convert exactly, e.g. `1.005` in a currency with 2 decimal places. It takes the decimal places from the currency (0 for JPY, 3 for KWD); `--minor-digits <n>` overrides that.
- They use the database in your environment or `.env`, and print which one before doing anything, so check that before running without `--dry-run`.

## Roadmap

Done:

- Company and invoice CRUD
- Validation of all request bodies, query parameters and IDs
- Typed errors and a central error handler
- RESTful, versioned routes with pagination metadata
- Swagger docs for every endpoint
- Amounts stored as integer minor units with an ISO 4217 currency
- API key authentication with read/write roles, security headers, a CORS allowlist, rate limiting, NoSQL injection protection, and patched dependencies

Planned:

- **Data integrity:** enforce status transitions, add unique indexes, and handle invoices when their company is deleted
- **Security:** limit each API key to its own data, and log which key made each change
- **Tests:** unit and integration tests (Jest or Vitest, Supertest, mongodb-memory-server)
- **Operations:** Docker, CI, linting, health checks, graceful shutdown, structured logging, and Swagger docs that work from the compiled build

## License

MIT. See [LICENSE](LICENSE).
