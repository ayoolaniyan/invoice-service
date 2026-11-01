import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import { createApp } from "../../src/app";
import { Invoice } from "../../src/models/invoice.schema";
import { READ_KEY, WRITE_KEY } from "../helpers/apiKeys";
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/db";
import { createCompany, createInvoice, createInvoiceWithStatus, invoiceInput } from "../helpers/fixtures";

const BASE = "/api/v1/invoices";
const MISSING_ID = "000000000000000000000000";

let app: Express;
let company: { _id: string; name: string; registrationNumber: string };

function errorFields(response: request.Response): string[] {
    return response.body.error.details.map((detail: { field: string }) => detail.field);
}

beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
});

beforeEach(async () => {
    await clearTestDatabase();
    company = await createCompany(app);
});

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(disconnectTestDatabase);

describe("POST /api/v1/invoices", () => {
    it("creates an invoice and copies the company's details onto it", async () => {
        const response = await request(app)
            .post(BASE)
            .set("X-API-Key", WRITE_KEY)
            .send(invoiceInput(company._id, { currency: "ngn", companyName: "Spoofed", companyRegistrationNumber: "SPOOFED" }));

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(`${BASE}/${response.body.data._id}`);
        expect(response.body.data).toMatchObject({
            amount: 15050,
            currency: "NGN",
            description: "Consulting",
            companyId: company._id,
            companyName: company.name,
            companyRegistrationNumber: company.registrationNumber,
        });
    });

    it("returns 404 when the company doesn't exist", async () => {
        const response = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(MISSING_ID));

        expect(response.status).toBe(404);
        expect(response.body.error.message).toContain(MISSING_ID);
    });

    it.each([
        ["a decimal amount", { amount: 150.5 }, "amount"],
        ["a negative amount", { amount: -1 }, "amount"],
        ["an amount too large to store exactly", { amount: 2 ** 53 }, "amount"],
        ["a missing currency", { currency: undefined }, "currency"],
        ["an unknown currency", { currency: "XYZ" }, "currency"],
        ["an unknown status", { status: "bogus" }, "status"],
        ["an invalid date", { issueDate: "yesterday" }, "issueDate"],
        ["a due date before the issue date", { issueDate: "2026-10-31", dueDate: "2026-10-01" }, "dueDate"],
        ["an invalid company ID", { companyId: "abc" }, "companyId"],
        ["an object instead of a string", { invoiceNumber: { $gt: "" } }, "invoiceNumber"],
        ["a list instead of a single value", { companyId: ["000000000000000000000000"] }, "companyId"],
    ])("returns 400 for %s", async (_description, overrides, field) => {
        const response = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(company._id, overrides));

        expect(response.status).toBe(400);
        expect(errorFields(response)).toContain(field);
    });
});

describe("GET /api/v1/invoices", () => {
    it("pages results without overlap", async () => {
        for (let i = 0; i < 23; i++) {
            await createInvoice(app, company._id);
        }

        const pages = await Promise.all(
            [1, 2, 3].map((page) => request(app).get(`${BASE}?limit=10&page=${page}`).set("X-API-Key", READ_KEY))
        );
        const ids = pages.flatMap((page) => page.body.data.map((invoice: { _id: string }) => invoice._id));

        expect(pages.map((page) => page.body.data.length)).toEqual([10, 10, 3]);
        expect(new Set(ids).size).toBe(23);
        expect(pages[0].body.meta).toEqual({ total: 23, page: 1, limit: 10, totalPages: 3 });
    });

    it("returns an empty page past the end", async () => {
        await createInvoice(app, company._id);

        const response = await request(app).get(`${BASE}?page=5`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
        expect(response.body.meta.total).toBe(1);
    });
});

describe("PATCH /api/v1/invoices/:id", () => {
    it("updates only allowed fields", async () => {
        const invoice = await createInvoice(app, company._id);

        const response = await request(app)
            .patch(`${BASE}/${invoice._id}`)
            .set("X-API-Key", WRITE_KEY)
            .send({ amount: 99999, status: "pending", companyName: "Spoofed", createdAt: "2000-01-01T00:00:00.000Z" });
        const stored = await request(app).get(`${BASE}/${invoice._id}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(200);
        expect(stored.body.data).toMatchObject({ amount: 99999, status: "pending", companyName: company.name, createdAt: invoice.createdAt });
    });

    it("requires amount when currency changes", async () => {
        const invoice = await createInvoice(app, company._id);

        const currencyOnly = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ currency: "USD" });
        const both = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ currency: "jpy", amount: 500 });

        expect(currencyOnly.status).toBe(400);
        expect(errorFields(currencyOnly)).toContain("currency");
        expect(both.status).toBe(200);
        expect(both.body.data).toMatchObject({ currency: "JPY", amount: 500 });
    });

    it("rejects a due date before the stored issue date", async () => {
        const invoice = await createInvoice(app, company._id);

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ dueDate: "2026-01-01" });

        expect(response.status).toBe(400);
        expect(errorFields(response)).toContain("dueDate");
    });

    it("moves the invoice to another company and copies its details", async () => {
        const invoice = await createInvoice(app, company._id);
        const other = await createCompany(app);

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ companyId: other._id });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ companyId: other._id, companyName: other.name, companyRegistrationNumber: other.registrationNumber });
    });

    it("returns 404 for an unknown invoice or company", async () => {
        const invoice = await createInvoice(app, company._id);

        const missingInvoice = await request(app).patch(`${BASE}/${MISSING_ID}`).set("X-API-Key", WRITE_KEY).send({ amount: 1 });
        const missingCompany = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ companyId: MISSING_ID });

        expect(missingInvoice.status).toBe(404);
        expect(missingCompany.status).toBe(404);
    });
});

describe("invoice numbers", () => {
    it("must be unique, ignoring case and surrounding spaces", async () => {
        await createInvoice(app, company._id, { invoiceNumber: "INV-2026-001" });

        const sameCase = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(company._id, { invoiceNumber: "INV-2026-001" }));
        const otherCase = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(company._id, { invoiceNumber: " inv-2026-001 " }));

        for (const response of [sameCase, otherCase]) {
            expect(response.status).toBe(409);
            expect(response.body.error.details).toEqual([{ field: "invoiceNumber", message: expect.stringContaining("already in use") }]);
        }
    });

    it("can't be changed to one that's already in use", async () => {
        await createInvoice(app, company._id, { invoiceNumber: "TAKEN" });
        const invoice = await createInvoice(app, company._id);

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ invoiceNumber: "taken" });

        expect(response.status).toBe(409);
    });

    it("allows only one of several simultaneous creates with the same number", async () => {
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(company._id, { invoiceNumber: "RACE-1" })))
        );

        expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409, 409, 409]);
    });
});

describe("status lifecycle", () => {
    it.each(["paid", "overdue", "cancelled"])("won't create an invoice as %s", async (status) => {
        const response = await request(app).post(BASE).set("X-API-Key", WRITE_KEY).send(invoiceInput(company._id, { status }));

        expect(response.status).toBe(400);
        expect(errorFields(response)).toContain("status");
    });

    it.each([
        ["draft", "pending"],
        ["draft", "cancelled"],
        ["pending", "paid"],
        ["pending", "overdue"],
        ["pending", "cancelled"],
        ["overdue", "paid"],
        ["overdue", "cancelled"],
    ])("allows %s -> %s", async (from, to) => {
        const invoice = await createInvoiceWithStatus(app, company._id, from);

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ status: to });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(to);
    });

    it.each([
        ["draft", "paid"],
        ["draft", "overdue"],
        ["pending", "draft"],
        ["overdue", "pending"],
        ["overdue", "draft"],
    ])("refuses %s -> %s with 409 and leaves the invoice unchanged", async (from, to) => {
        const invoice = await createInvoiceWithStatus(app, company._id, from);

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ status: to, amount: 1 });
        const after = await request(app).get(`${BASE}/${invoice._id}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(409);
        expect(response.body.error.message).toContain(`from ${from} to ${to}`);
        expect(after.body.data).toMatchObject({ status: from, amount: invoice.amount });
    });

    it.each(["paid", "cancelled"])("locks %s invoices against any change", async (status) => {
        const invoice = await createInvoiceWithStatus(app, company._id, status);

        const statusChange = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ status: "pending" });
        const fieldChange = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ description: "edited" });

        expect(statusChange.status).toBe(409);
        expect(fieldChange.status).toBe(409);
        expect(fieldChange.body.error.message).toContain("can no longer be changed");
    });

    it("lets other fields change while the status stays the same", async () => {
        const invoice = await createInvoiceWithStatus(app, company._id, "pending");

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ status: "pending", description: "Updated" });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ status: "pending", description: "Updated" });
    });

    it("rejects saving an invoice that changed since it was loaded", async () => {
        const invoice = await createInvoiceWithStatus(app, company._id, "pending");
        const first = await Invoice.findById(invoice._id);
        const second = await Invoice.findById(invoice._id);

        first!.status = "paid";
        await first!.save();
        second!.description = "edited from a stale copy";

        await expect(second!.save()).rejects.toBeInstanceOf(mongoose.Error.VersionError);
    });

    it("reports a concurrent change as 409", async () => {
        const invoice = await createInvoiceWithStatus(app, company._id, "pending");
        const stale = await Invoice.findById(invoice._id);
        await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ description: "changed meanwhile" });
        jest.spyOn(Invoice.prototype, "save").mockRejectedValueOnce(new mongoose.Error.VersionError(stale!, 0, ["description"]));

        const response = await request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ description: "mine" });

        expect(response.status).toBe(409);
        expect(response.body.error.message).toContain("changed by another request");
    });

    it("never ends up with two different outcomes from simultaneous status changes", async () => {
        const invoice = await createInvoiceWithStatus(app, company._id, "pending");

        const responses = await Promise.all(
            ["paid", "cancelled"].map((status) => request(app).patch(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY).send({ status }))
        );
        const after = await request(app).get(`${BASE}/${invoice._id}`).set("X-API-Key", READ_KEY);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        const winner = responses.find((response) => response.status === 200)!;
        expect(after.body.data.status).toBe(winner.body.data.status);
    });
});

describe("DELETE /api/v1/invoices/:id", () => {
    it("deletes a draft invoice", async () => {
        const invoice = await createInvoice(app, company._id, { status: "draft" });

        const response = await request(app).delete(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY);

        expect(response.status).toBe(204);
    });

    it.each(["pending", "overdue", "paid", "cancelled"])("refuses to delete a %s invoice with 409", async (status) => {
        const invoice = await createInvoiceWithStatus(app, company._id, status);

        const response = await request(app).delete(`${BASE}/${invoice._id}`).set("X-API-Key", WRITE_KEY);
        const after = await request(app).get(`${BASE}/${invoice._id}`).set("X-API-Key", READ_KEY);

        expect(response.status).toBe(409);
        expect(response.body.error.message).toContain("Only draft invoices can be deleted");
        expect(after.status).toBe(200);
    });

    it("returns 404 for an unknown invoice", async () => {
        const response = await request(app).delete(`${BASE}/${MISSING_ID}`).set("X-API-Key", WRITE_KEY);

        expect(response.status).toBe(404);
    });
});
