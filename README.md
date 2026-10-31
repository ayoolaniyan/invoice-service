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

Create a `.env` file in the project root:

```env
DATABASE_CONNECTION_STRING=mongodb://127.0.0.1:27017
DATABASE_NAME=invoice_service
PORT=3001
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_CONNECTION_STRING` | Yes | MongoDB connection URI |
| `DATABASE_NAME` | Yes | Database to use |
| `PORT` | Yes | Port the HTTP server listens on |

The app exits on startup if any of these are missing. `.env` is git-ignored, so never commit real credentials.

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
- Swagger UI: `http://localhost:<PORT>/api-docs`

## API

All endpoints are under `/api/v1`. Full request and response schemas are in the Swagger UI.

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
| `400` | Validation failed, malformed JSON, or an invalid ID |
| `404` | Resource or route not found |
| `409` | Conflict, e.g. a duplicate value or deleting an invoice whose status doesn't allow it |
| `500` | Unexpected error. Details are logged on the server, not returned to the client |

## Project structure

```
index.ts                  App setup and startup
scripts/                  One-off maintenance scripts
src/
  config/                 Dependency injection container, routes, Swagger
  controllers/            Read validated input from requests and call services
  errors/                 Typed errors (BadRequest, NotFound, Conflict)
  middlewares/            Request validation, response format, error handling
  models/                 Mongoose schemas and TypeScript interfaces
  routes/                 Express routers with their Swagger docs
  services/               Business logic and database access
  validators/             express-validator rules
```

A request goes through: router → validators → `validateRequest` → controller → service → Mongoose model. Errors thrown anywhere in that chain are turned into a JSON response by the central error handler.

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with nodemon and ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled app |
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

Planned:

- **Data integrity:** enforce status transitions, add unique indexes, and handle invoices when their company is deleted
- **Security:** authentication and authorization, helmet, a CORS allowlist, rate limiting, and dependency upgrades
- **Tests:** unit and integration tests (Jest or Vitest, Supertest, mongodb-memory-server)
- **Operations:** Docker, CI, linting, health checks, graceful shutdown, structured logging, and Swagger docs that work from the compiled build

## License

MIT. See [LICENSE](LICENSE).
