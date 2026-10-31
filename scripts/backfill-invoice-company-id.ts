/**
 * One-off migration: sets `companyId` on invoices created before it was stored.
 *
 * Each invoice is matched to a company by `companyRegistrationNumber`. Invoices
 * with no matching company, or with more than one, are skipped and reported so
 * they can be fixed by hand. Running it again only touches invoices that still
 * have no `companyId`.
 *
 * Usage:
 *   npm run migrate:backfill-company-id -- --dry-run   # report only, no writes
 *   npm run migrate:backfill-company-id
 */
import mongoose, { mongo, Types } from "mongoose";
import * as dotenv from "dotenv";
import { Company } from "../src/models/company.schema";
import { Invoice } from "../src/models/invoice.schema";

const BATCH_SIZE = 500;

interface ILegacyInvoice {
    _id: Types.ObjectId;
    invoiceNumber?: string;
    companyRegistrationNumber?: string;
}

async function findCompanyIdsByRegistrationNumber(): Promise<Map<string, Types.ObjectId[]>> {
    const companies = await Company.find({}, { registrationNumber: 1 }).lean();
    const byRegistrationNumber = new Map<string, Types.ObjectId[]>();

    for (const company of companies) {
        const ids = byRegistrationNumber.get(company.registrationNumber) ?? [];
        ids.push(company._id);
        byRegistrationNumber.set(company.registrationNumber, ids);
    }

    return byRegistrationNumber;
}

export async function backfill(dryRun: boolean) {
    const companyIds = await findCompanyIdsByRegistrationNumber();

    // Use the raw collection so documents that fail other (newer) schema rules can still be updated
    const cursor = Invoice.collection.find<ILegacyInvoice>(
        { $or: [{ companyId: { $exists: false } }, { companyId: null }] },
        { projection: { invoiceNumber: 1, companyRegistrationNumber: 1 } }
    );

    let scanned = 0;
    let updated = 0;
    const unmatched: ILegacyInvoice[] = [];
    const ambiguous: ILegacyInvoice[] = [];
    let batch: mongo.AnyBulkWriteOperation[] = [];

    const flush = async () => {
        if (batch.length === 0) {
            return;
        }
        if (!dryRun) {
            const result = await Invoice.collection.bulkWrite(batch, { ordered: false });
            updated += result.modifiedCount;
        } else {
            updated += batch.length;
        }
        batch = [];
    };

    for await (const invoice of cursor) {
        scanned++;
        const matches = companyIds.get(invoice.companyRegistrationNumber?.trim() ?? "") ?? [];

        if (matches.length === 0) {
            unmatched.push(invoice);
            continue;
        }
        if (matches.length > 1) {
            ambiguous.push(invoice);
            continue;
        }

        batch.push({
            updateOne: {
                // Re-check the filter so a concurrent write is never overwritten
                filter: { _id: invoice._id, $or: [{ companyId: { $exists: false } }, { companyId: null }] },
                update: { $set: { companyId: matches[0] } },
            },
        });

        if (batch.length >= BATCH_SIZE) {
            await flush();
        }
    }
    await flush();

    const describe = (invoice: ILegacyInvoice) =>
        `  - ${invoice._id} (invoice ${invoice.invoiceNumber ?? "?"}, registration number ${invoice.companyRegistrationNumber ?? "missing"})`;

    console.log(`${dryRun ? "[dry run] " : ""}Invoices without companyId: ${scanned}`);
    console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);

    if (unmatched.length > 0) {
        console.log(`Skipped, no company with that registration number: ${unmatched.length}`);
        unmatched.forEach((invoice) => console.log(describe(invoice)));
    }
    if (ambiguous.length > 0) {
        console.log(`Skipped, several companies share that registration number: ${ambiguous.length}`);
        ambiguous.forEach((invoice) => console.log(describe(invoice)));
    }

    return { scanned, updated, unmatched: unmatched.length, ambiguous: ambiguous.length, skipped: unmatched.length + ambiguous.length };
}

async function main() {
    dotenv.config();

    if (!process.env.DATABASE_CONNECTION_STRING || !process.env.DATABASE_NAME) {
        console.error("Missing required environment variables: DATABASE_CONNECTION_STRING and DATABASE_NAME");
        process.exit(1);
    }

    const dryRun = process.argv.includes("--dry-run");

    await mongoose.connect(process.env.DATABASE_CONNECTION_STRING, {
        dbName: process.env.DATABASE_NAME,
    });

    // Variables in .env are loaded when not set in the shell, so always show which database is targeted
    const { host, name } = mongoose.connection;
    console.log(`Database: ${name} on ${host}${dryRun ? " (dry run)" : ""}`);

    try {
        const { skipped } = await backfill(dryRun);
        process.exitCode = skipped > 0 ? 2 : 0;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
