import { TEST_API_KEYS } from "../helpers/apiKeys";

// Runs before each test file, so tests never depend on (or touch the database in) a developer's .env
process.env.NODE_ENV = "test";
process.env.API_KEYS = TEST_API_KEYS;
delete process.env.DATABASE_CONNECTION_STRING;
delete process.env.DATABASE_NAME;
delete process.env.CORS_ORIGINS;
delete process.env.RATE_LIMIT_MAX;
delete process.env.RATE_LIMIT_WINDOW_MS;
delete process.env.TRUST_PROXY;
delete process.env.ENABLE_API_DOCS;
