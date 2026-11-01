# Invoice Service

[![CI](https://github.com/ayoolaniyan/invoice-service/actions/workflows/ci.yml/badge.svg)](https://github.com/ayoolaniyan/invoice-service/actions/workflows/ci.yml)

A REST API for managing companies and their invoices, built with Node.js, Express 5, TypeScript, Mongoose and MongoDB.

Invoices belong to a company and move through a fixed lifecycle (`draft` → `pending` → `paid`, with `overdue` and `cancelled` along the way). Paid and cancelled invoices can't be changed.

**Features:**
- Every request is validated, and every response uses the same JSON format.
- Access is controlled with API keys that have read or write roles.
- Money is stored as whole numbers in the currency's smallest unit (e.g. kobo or cents), so there are no rounding errors.
- The service is ready to run in containers: health checks, graceful shutdown and structured JSON logs.

## Contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API](#api)
- [Operations](#operations)
- [Development](#development)
- [Deployment](#deployment)
- [Data migrations](#data-migrations)
- [Roadmap](#roadmap)

## Tech stack

| Area | Tools |
|---|---|
| Runtime | Node.js 20.19+, TypeScript 6 |
| Web framework | Express 5 |
| Database | MongoDB 8 with Mongoose |
| Validation | express-validator |
| Security | API keys, helmet, cors, express-rate-limit |
| Logging | pino, pino-http |
| Dependency injection | InversifyJS |
| API docs | OpenAPI 3 via swagger-jsdoc and swagger-ui-express |
| Testing | Jest, ts-jest, Supertest, mongodb-memory-server |
| Linting | ESLint with typescript-eslint |
| Delivery | Docker, docker compose, GitHub Actions |

## Quick start

### With Docker (app and MongoDB)

Requires Docker with Compose v2.

```bash
npm install                                  # only needed for the key generator
npm run api-key:generate -- local write      # prints a key and an API_KEYS entry

API_KEYS='<entry printed above>' docker compose up --build
```

The API is at `http://localhost:3001/api/v1`, and the Swagger UI is at `http://localhost:3001/api-docs`. You can also put `API_KEYS` in a `.env` file instead of the command line. Compose always uses its own MongoDB container, whatever database `.env` points to.

### Locally

Requires Node.js 20.19 or later and a MongoDB instance, either local or hosted (e.g. MongoDB Atlas).

```bash
npm install
cp .env.example .env                         # then fill in the values
npm run api-key:generate -- local-dev write  # put the printed entry in API_KEYS
npm run start:dev                            # restarts when files change
```

## Configuration

Settings are read from environment variables, or from a `.env` file in the project root (see `.env.example`). `.env` is git-ignored, so never commit real credentials. Variables already set in the environment take priority over `.env`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_CONNECTION_STRING` | Yes | | MongoDB connection URI |
| `DATABASE_NAME` | Yes | | Database to use |
| `PORT` | Yes | | Port the HTTP server listens on (the Docker image sets `3001`) |
| `API_KEYS` | Yes | | Comma-separated `name:role:sha256-hash` entries, one per client. See [Authentication](#authentication) |
| `NODE_ENV` | No | | `production` in production (the Docker image sets it). This turns off the Swagger UI and pretty logs |
| `LOG_LEVEL` | No | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `CORS_ORIGINS` | No | none | Comma-separated browser origins allowed to call the API, e.g. `https://app.example.com`. With none set, browsers can't call it from other sites; server-to-server calls aren't affected |
| `RATE_LIMIT_MAX` | No | `300` | Requests allowed per client IP per window |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate limit window in milliseconds |
| `TRUST_PROXY` | No | off | Number of proxies (load balancer, ingress) in front of the app, so rate limiting and logs see real client IPs. Leave unset if clients connect directly |
| `ENABLE_API_DOCS` | No | on unless `NODE_ENV=production` | `true` or `false` to force the Swagger UI on or off |

The app logs the problem and exits on startup if any of these happen:
- a required variable is missing, `PORT` isn't a valid port, or `API_KEYS` is malformed
- MongoDB can't be reached
- the unique indexes can't be built because the database already holds duplicates (see [Checking existing data](#checking-existing-data))

## API

All endpoints are under `/api/v1`. The Swagger UI at `/api-docs` has the full request and response schemas. Click **Authorize** and enter an API key to try requests from it.

### Authentication

Every request to `/api/v1` needs an API key in the `X-API-Key` header:

```bash
curl http://localhost:3001/api/v1/invoices -H "X-API-Key: <your key>"
```

| Role | Can use |
|---|---|
| `read` | `GET` endpoints only |
| `write` | All endpoints |

A missing or wrong key returns `401`, including for routes that don't exist, so the list of routes isn't revealed. A `read` key on a `POST`, `PATCH` or `DELETE` returns `403`.

**Managing keys:**
- **Create:** `npm run api-key:generate -- <name> <read|write>` prints a new key and its `API_KEYS` entry. Give the key to the client and add the entry to `API_KEYS`. In the Docker image, use `node dist/scripts/generate-api-key.js <name> <role>`.
- **Storage:** only the SHA-256 hash is stored, so a leaked config doesn't expose usable keys, and a lost key can't be recovered. Generate a new one instead.
- **Revoke:** remove the key's entry from `API_KEYS` and restart.
- **Rotate:** add the new entry, move the client over, then remove the old entry.

### Rate limiting

Each client IP can make `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`. This also counts requests with a wrong key, which slows down key guessing.
- **Headers:** responses carry `RateLimit` and `RateLimit-Policy` headers.
- **Over the limit:** the API returns `429` with a `Retry-After` header.
- **Not limited:** `/health` and `/ready`.
- **Behind a load balancer or proxy:** set `TRUST_PROXY`. Otherwise every client shares the proxy's IP, and therefore one limit.
- **Several instances:** the counters are kept in memory, so each instance has its own limit. To share one limit across instances, give express-rate-limit a shared store such as Redis.

### Companies

| Method | Path | Description | Success |
|---|---|---|---|
| `POST` | `/companies` | Create a company | `201` + `Location` header |
| `GET` | `/companies` | List companies (paginated) | `200` |
| `GET` | `/companies/:id` | Get a company | `200` |
| `PATCH` | `/companies/:id` | Update some fields of a company | `200` |
| `DELETE` | `/companies/:id` | Delete a company | `204` |

Rules:

- `registrationNumber` must be unique, ignoring case (`RC123` and `rc123` count as the same). It's set when the company is created and can't be changed afterwards. Other fields, such as `email`, may repeat, e.g. companies that share an accounting firm's address.
- A company that still has invoices can't be deleted (`409`). Delete its draft invoices or move them to another company first.

### Invoices

| Method | Path | Description | Success |
|---|---|---|---|
| `POST` | `/invoices` | Create an invoice | `201` + `Location` header |
| `GET` | `/invoices` | List invoices (paginated) | `200` |
| `GET` | `/invoices/:id` | Get an invoice | `200` |
| `PATCH` | `/invoices/:id` | Update some fields of an invoice | `200` |
| `DELETE` | `/invoices/:id` | Delete an invoice | `204` |

Rules:

- `invoiceNumber` must be unique, ignoring case and surrounding spaces. A duplicate returns `409`, even when two requests race to use the same number.
- An invoice must reference an existing company through `companyId`. The company's name and registration number are copied onto the invoice by the server; values sent by the client are ignored. The copy keeps the details as they were when the invoice was issued, so it isn't updated if the company changes later.
- `dueDate` can't be before `issueDate`.
- `amount` is a whole number in the currency's **minor unit** (kobo, cents, etc.), so `15050` with `NGN` means ₦150.50. Decimals are rejected. This avoids floating-point rounding errors such as `0.1 + 0.2 = 0.30000000000000004`.
- `currency` is a required ISO 4217 code such as `NGN` or `USD`. Lower case is accepted and stored in upper case. To change it on an update, send `amount` in the same request, because the same number means a different value in another currency.

#### Invoice lifecycle

```
draft ──> pending ──> paid
  │          │  └──> overdue ──> paid
  │          │          │
  └──────────┴──────────┴──> cancelled
```

- **New invoices** start as `draft` or `pending`.
- **Status changes** must follow the arrows. Any other change, e.g. `paid` → `pending`, returns `409` with the changes allowed from the current status.
- **`paid` and `cancelled` are final:** the invoice can't be changed at all.
- **Only drafts can be deleted.** An invoice that has been issued is cancelled instead, so every invoice number that was sent stays on record.
- **Simultaneous updates:** if two requests change the same invoice at the same time, the second gets `409` instead of silently overwriting the first. Reload the invoice and try again.

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
| `409` | Conflict with the current data: a duplicate invoice or registration number, a status change the lifecycle doesn't allow, a change to a paid or cancelled invoice, deleting an issued invoice or a company that has invoices, or a change made by another request at the same time |
| `413` | Request body larger than 100 KB |
| `429` | Rate limit exceeded |
| `500` | Unexpected error. Details are logged on the server, not returned to the client |
| `503` | `/ready` only: the app can't serve traffic right now |

## Operations

### Health checks

These endpoints need no API key and aren't rate limited.

| Endpoint | Use for | Returns |
|---|---|---|
| `GET /health` | Liveness: is the process up? | Always `200` while the process can respond |
| `GET /ready` | Readiness: should it get traffic? | `200` when MongoDB answers a ping. `503` if MongoDB is unreachable or the app is shutting down |

The Docker image's `HEALTHCHECK` calls `/health`. In Kubernetes, use `/health` for the liveness probe and `/ready` for the readiness probe.

### Logging

Logs are structured JSON, one object per line, written to stdout by pino, ready for any log collector.
- **Request lines:** each request is logged once, with its method, URL, status, response time, request ID and the name of the API key used.
- **Request IDs:** every response has an `X-Request-Id` header. A safe incoming `X-Request-Id`, e.g. from a load balancer, is reused, so one ID follows the request across services. Quote it when reporting a problem.
- **Log levels:** `4xx` responses are logged as `warn`, and `5xx` responses as `error` with the stack trace.
- **Redaction:** API keys, `Authorization` and cookies are always removed from logs.
- **Local development:** in a terminal, logs are pretty-printed with pino-pretty.

### Graceful shutdown

On `SIGTERM` or `SIGINT`, the app:
1. Starts returning `503` from `/ready`, so load balancers stop sending traffic.
2. Stops accepting new connections.
3. Waits for in-flight requests to finish, then closes the MongoDB connection and exits with code `0`.

If requests haven't finished after 10 seconds, it exits with code `1`. Unhandled errors are logged as `fatal` and also exit with code `1`, so the orchestrator restarts the app from a clean state.

## Development

### Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with nodemon and ts-node, restarting on changes |
| `npm run build` | Compile the app and scripts to `dist/` (tests are left out) |
| `npm start` | Run the compiled app |
| `npm test` | Run all unit and integration tests |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run test:integration` | Integration tests only |
| `npm run test:coverage` | All tests with a coverage report in `coverage/` |
| `npm run lint` / `lint:fix` | Lint, or lint and fix what can be fixed automatically |
| `npm run typecheck` | Type-check everything, including tests |
| `npm run check` | Lint, type-check and test: what CI runs |
| `npm run api-key:generate -- <name> <read\|write>` | Create an API key and its `API_KEYS` entry |
| `npm run check:data` | Read-only report of duplicates and other data problems, see [Checking existing data](#checking-existing-data) |
| `npm run migrate:*` | Data migrations, see [Data migrations](#data-migrations) |

### Testing

- **Unit tests** (`tests/unit/`) cover pure logic: the invoice lifecycle, money conversion, API key parsing, pagination and security config.
- **Integration tests** (`tests/integration/`) send real HTTP requests to the app with Supertest. They run against an in-memory MongoDB started by [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server), and cover:
  - every endpoint, with validation and error cases
  - every allowed and refused status change, unique numbers (including simultaneous creates) and concurrent updates
  - authentication, roles and rate limiting
  - CORS, security headers and request IDs
  - health checks
  - the data check and both data migrations

To keep tests isolated:
- Each test file uses its own database, so files run in parallel.
- Tests never read `.env`, so they can't touch a real database.
- The first run downloads a MongoDB binary (about 100 MB, cached in `~/.cache/mongodb-binaries`). To use a MongoDB you already have installed instead, run `MONGOMS_SYSTEM_BINARY=$(which mongod) npm test`.

The build fails if coverage of `src/` drops below 90% of lines (75% of branches).

### Project structure

```
index.ts                  Startup: config checks, database connection and indexes, graceful shutdown
scripts/                  CLI tools: API key generator, data check and data migrations
src/
  app.ts                  Builds the Express app (used by index.ts and the tests)
  config/                 Dependency injection, routes, Swagger, API keys, CORS, logger
  controllers/            Read validated input from requests and call services
  errors/                 Typed errors (BadRequest, Unauthorized, Forbidden, NotFound, ...)
  middlewares/            Auth, rate limiting, request logging, validation, response format, errors
  models/                 Mongoose schemas and TypeScript interfaces
  routes/                 Express routers with their Swagger docs, and health checks
  services/               Business logic and database access
  utils/                  Shared helpers (money conversion)
  validators/             express-validator rules
tests/
  unit/                   Tests without a database
  integration/            HTTP tests against an in-memory MongoDB
  helpers/, setup/        Test API keys, fixtures, database and Jest setup
```

A request goes through: security headers (helmet) → request logger → health checks → CORS → rate limiter → JSON body parser → `authenticate` (API key) → router → `authorize` (role) → validators → `validateRequest` → controller → service → Mongoose model. Errors thrown anywhere in that chain are turned into a JSON response by the central error handler.

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. It has three jobs:
- **Test:** on Node 20, 22 and 24, runs lint, type-check, the tests with coverage, and the build.
- **Audit:** fails on high or critical advisories in production dependencies.
- **Docker:** builds the image, starts it with a MongoDB container, and checks that `/ready` and an authenticated API call succeed.

## Deployment

The `Dockerfile` builds a small production image:
- **Two stages:** TypeScript is compiled in a build stage, and the final image has only production dependencies and `dist/`.
- **Runs as the unprivileged `node` user.**
- **Health check:** a `HEALTHCHECK` calls `/health`.
- **Signals:** `node` is started directly, not through npm, so `SIGTERM` reaches the app and it shuts down gracefully.

```bash
docker build -t invoice-service .
docker run -p 3001:3001 \
  -e DATABASE_CONNECTION_STRING='mongodb+srv://...' \
  -e DATABASE_NAME=invoice_service \
  -e API_KEYS='<entries>' \
  invoice-service
```

Production checklist:

- [ ] Pass secrets (`DATABASE_CONNECTION_STRING`, `API_KEYS`) through your platform's secret store, not a `.env` file in the image.
- [ ] Generate one API key per client, with the narrowest role it needs.
- [ ] Set `CORS_ORIGINS` if a browser app calls the API.
- [ ] Set `TRUST_PROXY` to the number of proxies in front of the app.
- [ ] Serve the API over HTTPS. TLS is expected to end at the load balancer or ingress.
- [ ] Before the first deploy of this version against existing data, run `npm run check:data` and fix anything it lists.
- [ ] Point liveness checks at `/health` and readiness checks at `/ready`.
- [ ] Use a shared rate-limit store if you run more than one instance.

## Checking existing data

`npm run check:data` is a read-only report. It changes nothing, and lists:

- invoice numbers and company registration numbers used more than once, ignoring case and surrounding spaces
- invoices whose company no longer exists
- invoices with a status outside the lifecycle

Run it before deploying against a database that already has data. The app builds its unique indexes at startup and refuses to start while duplicates block them, because serving without the indexes would let more duplicates in. Fix what the report lists, run it again until it says `No problems found.`, then deploy.
- **Exit code:** `2` if it found problems, so it can gate a deploy pipeline.
- **In the Docker image:** run `node dist/scripts/check-data-integrity.js`.

## Data migrations

Two one-off scripts update data written by older versions of the service:

| Command | What it does |
|---|---|
| `npm run migrate:backfill-company-id` | Sets `companyId` on invoices created before it was stored, matching companies by registration number |
| `npm run migrate:amounts-to-minor-units -- --currency NGN` | Converts decimal amounts on invoices created before currencies were stored (e.g. `150.5` → `15050`) and sets their currency |

In the Docker image, run them as `node dist/scripts/<name>.js` with the same arguments.

- Add `--dry-run` to see what would change without writing anything. With `npm run`, put it after `--`, e.g. `npm run migrate:backfill-company-id -- --dry-run`.
- Both are safe to run again: they only touch invoices that haven't been migrated yet.
- They never guess. Invoices they can't migrate are skipped and listed, and the script exits with code `2`.
  - `backfill-company-id` skips any invoice that doesn't match exactly one company.
  - `amounts-to-minor-units` skips any amount it can't convert exactly, e.g. `1.005` in a currency with 2 decimal places. It takes the decimal places from the currency (0 for JPY, 3 for KWD); `--minor-digits <n>` overrides that.
- They use the database in your environment or `.env`, and print which one before doing anything, so check that before running without `--dry-run`.

## Roadmap

Done:

- Company and invoice CRUD with validation, typed errors and a central error handler
- RESTful, versioned routes with pagination metadata and OpenAPI docs
- Amounts stored as integer minor units with an ISO 4217 currency
- API key authentication with read/write roles, security headers, a CORS allowlist, rate limiting and NoSQL injection protection
- Unit and integration tests, linting, CI, Docker, health checks, graceful shutdown and structured logging
- Data integrity:
  - invoice lifecycle rules
  - unique invoice and registration numbers
  - companies with invoices can't be deleted
  - concurrent updates can't overwrite each other

Planned:

- **Automation:** mark invoices `overdue` automatically when their due date passes (today a client sets it)
- **Transactions:** close the small gap between the company-delete check and the delete. This needs MongoDB transactions, which need a replica set (Atlas provides one)
- **Security:** limit each API key to its own data, and record which key made each change
- **API:** filter invoice lists by status, company and date range

## License

MIT. See [LICENSE](LICENSE).
