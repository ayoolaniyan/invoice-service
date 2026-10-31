import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { InvoiceService } from "../../src/services/invoice.service";
import { READ_KEY, WRITE_KEY } from "../helpers/apiKeys";
import { connectTestDatabase, disconnectTestDatabase } from "../helpers/db";

let app: Express;

beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
});

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(disconnectTestDatabase);

describe("error handling", () => {
    it("returns 400 JSON for malformed JSON", async () => {
        const response = await request(app)
            .post("/api/v1/companies")
            .set("X-API-Key", WRITE_KEY)
            .set("Content-Type", "application/json")
            .send("{not json");

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ status: "error", statusCode: 400 });
    });

    it("returns 413 for a body over 100 KB", async () => {
        const response = await request(app)
            .post("/api/v1/companies")
            .set("X-API-Key", WRITE_KEY)
            .send({ name: "x".repeat(150 * 1024) });

        expect(response.status).toBe(413);
    });

    it("returns 404 JSON for unknown routes outside the API", async () => {
        const response = await request(app).get("/nope");

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ status: "error", statusCode: 404 });
    });

    it("hides the details of unexpected errors", async () => {
        jest.spyOn(InvoiceService.prototype, "getInvoicesById").mockRejectedValue(new Error("connection string mongodb://user:secret@host"));

        const response = await request(app).get("/api/v1/invoices/000000000000000000000000").set("X-API-Key", READ_KEY);

        expect(response.status).toBe(500);
        expect(response.body.error).toEqual({ message: "Internal server error" });
        expect(JSON.stringify(response.body)).not.toContain("secret");
    });
});
