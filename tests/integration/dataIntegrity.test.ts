import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import { checkDataIntegrity } from "../../scripts/check-data-integrity";
import { ensureIndexes } from "../../src/config/database.config";
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/db";

const invoices = () => mongoose.connection.collection("invoices");
const companies = () => mongoose.connection.collection("companies");

beforeAll(async () => {
    // Start without indexes, like a database holding data written before they existed
    await connectTestDatabase({ indexes: false });
});

beforeEach(async () => {
    await clearTestDatabase();
    await Promise.all([invoices().dropIndexes().catch(() => undefined), companies().dropIndexes().catch(() => undefined)]);
});

afterAll(disconnectTestDatabase);

describe("check-data-integrity", () => {
    it("reports nothing for clean data", async () => {
        const companyId = new Types.ObjectId();
        await companies().insertOne({ _id: companyId, registrationNumber: "RC1" });
        await invoices().insertOne({ invoiceNumber: "INV-1", status: "draft", companyId });

        expect(await checkDataIntegrity()).toEqual({
            duplicateInvoiceNumbers: [],
            duplicateRegistrationNumbers: [],
            orphanedInvoiceIds: [],
            invalidStatusInvoiceIds: [],
        });
    });

    it("finds duplicates (ignoring case and spaces), orphaned invoices and invalid statuses", async () => {
        const companyId = new Types.ObjectId();
        await companies().insertMany([
            { _id: companyId, registrationNumber: "RC1" },
            { registrationNumber: " rc1" },
            { registrationNumber: "RC2" },
        ]);
        const orphan = new Types.ObjectId();
        const badStatus = new Types.ObjectId();
        await invoices().insertMany([
            { invoiceNumber: "INV-1", status: "draft", companyId },
            { invoiceNumber: "inv-1", status: "draft", companyId },
            { _id: orphan, invoiceNumber: "INV-2", status: "draft", companyId: new Types.ObjectId() },
            { _id: badStatus, invoiceNumber: "INV-3", status: "bogus", companyId },
        ]);

        const report = await checkDataIntegrity();

        expect(report.duplicateInvoiceNumbers).toEqual([expect.objectContaining({ _id: "inv-1", values: expect.arrayContaining(["INV-1", "inv-1"]) })]);
        expect(report.duplicateRegistrationNumbers).toEqual([expect.objectContaining({ _id: "rc1" })]);
        expect(report.orphanedInvoiceIds).toEqual([orphan]);
        expect(report.invalidStatusInvoiceIds).toEqual([badStatus]);
    });

    it("finds exactly the duplicates that stop the app's index build", async () => {
        await invoices().insertMany([{ invoiceNumber: "DUP" }, { invoiceNumber: "dup" }]);

        await expect(ensureIndexes()).rejects.toThrow(/duplicate key/i);
        expect((await checkDataIntegrity()).duplicateInvoiceNumbers).toHaveLength(1);

        await invoices().deleteOne({ invoiceNumber: "dup" });
        await expect(ensureIndexes()).resolves.toBeUndefined();
    });
});
