import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import { backfill } from "../../scripts/backfill-invoice-company-id";
import { convert } from "../../scripts/convert-invoice-amounts-to-minor-units";
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/db";

const invoices = () => mongoose.connection.collection("invoices");
const companies = () => mongoose.connection.collection("companies");

async function findByNumber(invoiceNumber: string) {
    return invoices().findOne({ invoiceNumber });
}

beforeAll(async () => {
    await connectTestDatabase();
    // The scripts report progress with console.log; keep test output clean
    jest.spyOn(console, "log").mockImplementation(() => undefined);
});

beforeEach(clearTestDatabase);

afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDatabase();
});

describe("backfill-invoice-company-id", () => {
    beforeEach(async () => {
        const acme = new Types.ObjectId();
        await companies().insertMany([
            { _id: acme, name: "Acme", registrationNumber: "RC1" },
            { name: "Beta One", registrationNumber: "RC2" },
            { name: "Beta Two", registrationNumber: "RC2" },
        ]);
        await invoices().insertMany([
            { invoiceNumber: "MATCH", companyRegistrationNumber: "RC1" },
            { invoiceNumber: "PADDED", companyRegistrationNumber: " RC1 ", companyId: null },
            { invoiceNumber: "AMBIGUOUS", companyRegistrationNumber: "RC2" },
            { invoiceNumber: "UNMATCHED", companyRegistrationNumber: "RC9" },
            { invoiceNumber: "ALREADY-SET", companyRegistrationNumber: "RC1", companyId: new Types.ObjectId() },
        ]);
    });

    it("reports without writing on a dry run", async () => {
        const result = await backfill(true);

        expect(result).toEqual({ scanned: 4, updated: 2, unmatched: 1, ambiguous: 1, skipped: 2 });
        expect((await findByNumber("MATCH"))?.companyId).toBeUndefined();
    });

    it("sets companyId on matched invoices only, and is safe to run again", async () => {
        const acme = await companies().findOne({ registrationNumber: "RC1" });
        const alreadySet = (await findByNumber("ALREADY-SET"))?.companyId;

        const first = await backfill(false);
        const second = await backfill(false);

        expect(first.updated).toBe(2);
        expect(second).toMatchObject({ scanned: 2, updated: 0 });
        expect((await findByNumber("MATCH"))?.companyId).toEqual(acme?._id);
        expect((await findByNumber("PADDED"))?.companyId).toEqual(acme?._id);
        expect((await findByNumber("AMBIGUOUS"))?.companyId).toBeUndefined();
        expect((await findByNumber("UNMATCHED"))?.companyId).toBeUndefined();
        expect((await findByNumber("ALREADY-SET"))?.companyId).toEqual(alreadySet);
    });
});

describe("convert-invoice-amounts-to-minor-units", () => {
    beforeEach(async () => {
        await invoices().insertMany([
            { invoiceNumber: "A", amount: 150.5 },
            { invoiceNumber: "B", amount: 0.29 },
            { invoiceNumber: "C", amount: 1.005 },
            { invoiceNumber: "D", amount: "abc" },
            { invoiceNumber: "E" },
            { invoiceNumber: "F", amount: 777, currency: "USD" },
        ]);
    });

    it("reports without writing on a dry run", async () => {
        const result = await convert("NGN", 2, true);

        expect(result).toEqual({ scanned: 5, converted: 2, skipped: 3 });
        expect((await findByNumber("A"))?.amount).toBe(150.5);
    });

    it("converts exactly, skips what it can't convert, and is safe to run again", async () => {
        const first = await convert("NGN", 2, false);
        const second = await convert("NGN", 2, false);

        expect(first).toEqual({ scanned: 5, converted: 2, skipped: 3 });
        expect(second).toEqual({ scanned: 3, converted: 0, skipped: 3 });
        expect(await findByNumber("A")).toMatchObject({ amount: 15050, currency: "NGN" });
        expect(await findByNumber("B")).toMatchObject({ amount: 29, currency: "NGN" });
        expect(await findByNumber("C")).toMatchObject({ amount: 1.005 });
        expect((await findByNumber("C"))?.currency).toBeUndefined();
        expect(await findByNumber("F")).toMatchObject({ amount: 777, currency: "USD" });
    });
});
