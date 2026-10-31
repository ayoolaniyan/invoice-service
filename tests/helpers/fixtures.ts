import request from "supertest";
import { Express } from "express";
import { WRITE_KEY } from "./apiKeys";

let sequence = 0;

export function companyInput(overrides: Record<string, unknown> = {}) {
    sequence++;
    return {
        name: `Acme ${sequence} Ltd`,
        registrationNumber: `RC${sequence}`,
        email: `billing${sequence}@acme.test`,
        phone: "+2348000000000",
        address: "1 Marina Road, Lagos",
        ...overrides,
    };
}

export function invoiceInput(companyId: string, overrides: Record<string, unknown> = {}) {
    sequence++;
    return {
        invoiceNumber: `INV-${sequence}`,
        description: "Consulting",
        issueDate: "2026-10-01",
        dueDate: "2026-10-31",
        status: "draft",
        amount: 15050,
        currency: "NGN",
        companyId,
        ...overrides,
    };
}

export async function createCompany(app: Express, overrides: Record<string, unknown> = {}) {
    const response = await request(app).post("/api/v1/companies").set("X-API-Key", WRITE_KEY).send(companyInput(overrides));
    if (response.status !== 201) {
        throw new Error(`Could not create company: ${response.status} ${JSON.stringify(response.body)}`);
    }
    return response.body.data;
}

export async function createInvoice(app: Express, companyId: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app).post("/api/v1/invoices").set("X-API-Key", WRITE_KEY).send(invoiceInput(companyId, overrides));
    if (response.status !== 201) {
        throw new Error(`Could not create invoice: ${response.status} ${JSON.stringify(response.body)}`);
    }
    return response.body.data;
}
