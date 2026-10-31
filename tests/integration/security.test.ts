import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { READ_KEY, WRITE_KEY } from "../helpers/apiKeys";
import { connectTestDatabase, disconnectTestDatabase } from "../helpers/db";
import { companyInput, createCompany } from "../helpers/fixtures";

const ORIGINAL_ENV = { ...process.env };

let app: Express;

beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

afterAll(disconnectTestDatabase);

describe("authentication", () => {
    it("returns 401 without an API key", async () => {
        const response = await request(app).get("/api/v1/invoices");

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: "error", statusCode: 401 });
        expect(response.body.error.message).toContain("X-API-Key");
    });

    it("returns 401 for a wrong key", async () => {
        const response = await request(app).get("/api/v1/invoices").set("X-API-Key", "wrong");

        expect(response.status).toBe(401);
        expect(response.body.error.message).toBe("Invalid API key");
    });

    it("doesn't accept the key as a bearer token", async () => {
        const response = await request(app).get("/api/v1/invoices").set("Authorization", `Bearer ${WRITE_KEY}`);

        expect(response.status).toBe(401);
    });

    it("doesn't reveal which API routes exist without a key", async () => {
        const withoutKey = await request(app).get("/api/v1/does-not-exist");
        const withKey = await request(app).get("/api/v1/does-not-exist").set("X-API-Key", READ_KEY);

        expect(withoutKey.status).toBe(401);
        expect(withKey.status).toBe(404);
    });
});

describe("authorization", () => {
    it("lets read keys use GET endpoints", async () => {
        const response = await request(app).get("/api/v1/companies").set("X-API-Key", READ_KEY);

        expect(response.status).toBe(200);
    });

    it("returns 403 when a read key tries to change data, and changes nothing", async () => {
        const company = await createCompany(app);

        const create = await request(app).post("/api/v1/companies").set("X-API-Key", READ_KEY).send(companyInput());
        const update = await request(app).patch(`/api/v1/companies/${company._id}`).set("X-API-Key", READ_KEY).send({ phone: "1" });
        const remove = await request(app).delete(`/api/v1/companies/${company._id}`).set("X-API-Key", READ_KEY);
        const after = await request(app).get(`/api/v1/companies/${company._id}`).set("X-API-Key", READ_KEY);

        expect([create.status, update.status, remove.status]).toEqual([403, 403, 403]);
        expect(after.body.data.phone).toBe(company.phone);
    });
});

describe("rate limiting", () => {
    it("returns 429 with Retry-After once the limit is used, including for bad keys", async () => {
        process.env.RATE_LIMIT_MAX = "3";
        const limitedApp = createApp();

        const statuses = [];
        for (let i = 0; i < 3; i++) {
            statuses.push((await request(limitedApp).get("/api/v1/invoices").set("X-API-Key", `guess-${i}`)).status);
        }
        const blocked = await request(limitedApp).get("/api/v1/invoices").set("X-API-Key", READ_KEY);

        expect(statuses).toEqual([401, 401, 401]);
        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({ status: "error", statusCode: 429 });
        expect(blocked.headers["retry-after"]).toBeDefined();
    });

    it("doesn't rate limit health checks", async () => {
        process.env.RATE_LIMIT_MAX = "1";
        const limitedApp = createApp();

        await request(limitedApp).get("/api/v1/invoices");
        const statuses = await Promise.all([1, 2, 3].map(() => request(limitedApp).get("/health").then((response) => response.status)));

        expect(statuses).toEqual([200, 200, 200]);
    });
});

describe("CORS", () => {
    it("allows only configured origins", async () => {
        process.env.CORS_ORIGINS = "https://app.example.com";
        const corsApp = createApp();

        const allowed = await request(corsApp)
            .options("/api/v1/invoices")
            .set("Origin", "https://app.example.com")
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "x-api-key,content-type");
        const denied = await request(corsApp)
            .options("/api/v1/invoices")
            .set("Origin", "https://evil.example.com")
            .set("Access-Control-Request-Method", "POST");

        expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example.com");
        expect(allowed.headers["access-control-allow-headers"]).toMatch(/x-api-key/i);
        expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    });
});

describe("security headers and request IDs", () => {
    it("sets helmet headers and hides X-Powered-By", async () => {
        const response = await request(app).get("/health");

        expect(response.headers["x-powered-by"]).toBeUndefined();
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["content-security-policy"]).toBeDefined();
        expect(response.headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
    });

    it("generates a request ID, or reuses a safe incoming one", async () => {
        const generated = await request(app).get("/health");
        const reused = await request(app).get("/health").set("X-Request-Id", "lb-1234");
        const unsafe = await request(app).get("/health").set("X-Request-Id", "<script>alert(1)</script>");

        expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
        expect(reused.headers["x-request-id"]).toBe("lb-1234");
        expect(unsafe.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    });
});

describe("API docs", () => {
    it("are served outside production", async () => {
        const response = await request(app).get("/api-docs/");

        expect(response.status).toBe(200);
    });

    it("are hidden in production unless enabled", async () => {
        process.env.NODE_ENV = "production";
        const hidden = await request(createApp()).get("/api-docs/");
        process.env.ENABLE_API_DOCS = "true";
        const enabled = await request(createApp()).get("/api-docs/");

        expect(hidden.status).toBe(404);
        expect(enabled.status).toBe(200);
    });
});
