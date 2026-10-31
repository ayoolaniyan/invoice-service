import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { READ_KEY, WRITE_KEY } from "../helpers/apiKeys";
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/db";
import { companyInput, createCompany } from "../helpers/fixtures";

const BASE = "/api/v1/companies";
const MISSING_ID = "000000000000000000000000";

let app: Express;

beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
});

beforeEach(clearTestDatabase);

afterAll(disconnectTestDatabase);

describe("POST /api/v1/companies", () => {
    it("creates a company and returns 201 with a Location header", async () => {
        const input = companyInput({ email: "Billing@Acme.TEST" });

        const response = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(input);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ status: "success", statusCode: 201 });
        expect(response.body.data).toMatchObject({ name: input.name, registrationNumber: input.registrationNumber, email: "billing@acme.test" });
        expect(response.headers.location).toBe(`${BASE}/${response.body.data._id}`);
    });

    it("returns 400 with a message per invalid field", async () => {
        const response = await request(app)
            .post(BASE)
            .set("X-API-Key", WRITE_KEY)
            .send({ name: "x".repeat(101), email: "not-an-email", phone: "", address: "x" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Validation failed");
        const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
        expect(fields).toEqual(expect.arrayContaining(["name", "registrationNumber", "email", "phone"]));
    });

    it("ignores fields that aren't part of the schema", async () => {
        const response = await request(app)
            .post(BASE)
            .set("X-API-Key", WRITE_KEY)
            .send({ ...companyInput(), _id: MISSING_ID, createdAt: "2000-01-01T00:00:00.000Z", isAdmin: true });

        expect(response.status).toBe(201);
        expect(response.body.data._id).not.toBe(MISSING_ID);
        expect(response.body.data.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
        expect(response.body.data.isAdmin).toBeUndefined();
    });
});

describe("GET /api/v1/companies", () => {
    it("pages results and returns pagination metadata", async () => {
        for (let i = 0; i < 12; i++) {
            await createCompany(app);
        }

        const page1 = await request(app).get(`${BASE}?limit=5&page=1`).set("X-API-Key", READ_KEY);
        const page3 = await request(app).get(`${BASE}?limit=5&page=3`).set("X-API-Key", READ_KEY);

        expect(page1.status).toBe(200);
        expect(page1.body.data).toHaveLength(5);
        expect(page1.body.meta).toEqual({ total: 12, page: 1, limit: 5, totalPages: 3 });
        expect(page3.body.data).toHaveLength(2);
    });

    it("sorts by creation date in the requested order", async () => {
        const first = await createCompany(app);
        const second = await createCompany(app);

        const asc = await request(app).get(`${BASE}?order=asc`).set("X-API-Key", READ_KEY);
        const desc = await request(app).get(`${BASE}?order=desc`).set("X-API-Key", READ_KEY);

        expect(asc.body.data.map((company: { _id: string }) => company._id)).toEqual([first._id, second._id]);
        expect(desc.body.data.map((company: { _id: string }) => company._id)).toEqual([second._id, first._id]);
    });

    it.each([
        ["page=0", "page"],
        ["limit=101", "limit"],
        ["limit=abc", "limit"],
        ["order=dsc", "order"],
        ["page=1&page=2", "page"],
    ])("returns 400 for ?%s", async (query, field) => {
        const response = await request(app).get(`${BASE}?${query}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(400);
        expect(response.body.error.details[0].field).toBe(field);
    });
});

describe("GET /api/v1/companies/:id", () => {
    it("returns the company", async () => {
        const company = await createCompany(app);

        const response = await request(app).get(`${BASE}/${company._id}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(200);
        expect(response.body.data._id).toBe(company._id);
    });

    it("returns 404 for an unknown ID and 400 for an invalid one", async () => {
        const missing = await request(app).get(`${BASE}/${MISSING_ID}`).set("X-API-Key", READ_KEY);
        const invalid = await request(app).get(`${BASE}/not-an-id`).set("X-API-Key", READ_KEY);

        expect(missing.status).toBe(404);
        expect(invalid.status).toBe(400);
    });
});

describe("PATCH /api/v1/companies/:id", () => {
    it("updates only the fields sent and can't change the registration number", async () => {
        const company = await createCompany(app);

        const response = await request(app)
            .patch(`${BASE}/${company._id}`)
            .set("X-API-Key", WRITE_KEY)
            .send({ phone: "+2349999999999", registrationNumber: "CHANGED" });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ phone: "+2349999999999", name: company.name, registrationNumber: company.registrationNumber });
    });

    it("returns 400 for invalid values and 404 for an unknown ID", async () => {
        const company = await createCompany(app);

        const invalid = await request(app).patch(`${BASE}/${company._id}`).set("X-API-Key", WRITE_KEY).send({ email: "nope" });
        const missing = await request(app).patch(`${BASE}/${MISSING_ID}`).set("X-API-Key", WRITE_KEY).send({ phone: "1" });

        expect(invalid.status).toBe(400);
        expect(missing.status).toBe(404);
    });

    it("rejects PUT", async () => {
        const company = await createCompany(app);

        const response = await request(app).put(`${BASE}/${company._id}`).set("X-API-Key", WRITE_KEY).send({ phone: "1" });

        expect(response.status).toBe(404);
    });
});

describe("DELETE /api/v1/companies/:id", () => {
    it("deletes the company and returns 204 with no body", async () => {
        const company = await createCompany(app);

        const response = await request(app).delete(`${BASE}/${company._id}`).set("X-API-Key", WRITE_KEY);
        const after = await request(app).get(`${BASE}/${company._id}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(204);
        expect(response.text).toBe("");
        expect(after.status).toBe(404);
    });

    it("returns 404 for an unknown ID", async () => {
        const response = await request(app).delete(`${BASE}/${MISSING_ID}`).set("X-API-Key", WRITE_KEY);

        expect(response.status).toBe(404);
    });
});
