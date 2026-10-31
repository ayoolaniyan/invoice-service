/**
 * One-off migration: converts invoice amounts stored as decimal major units
 * (e.g. 150.5) to integer minor units (e.g. 15050) and sets their currency.
 *
 * Only invoices with no `currency` field are touched, since every invoice saved
 * after this change has one. Running it again only touches invoices that still
 * have no currency. Amounts that can't be converted exactly (negative, not a
 * number, or with more decimals than the currency allows) are skipped and
 * reported instead of being rounded.
 *
 * Usage:
 *   npm run migrate:amounts-to-minor-units -- --currency NGN --dry-run   # report only, no writes
 *   npm run migrate:amounts-to-minor-units -- --currency NGN
 *   npm run migrate:amounts-to-minor-units -- --currency XYZ --minor-digits 2   # override the decimal places
 */
import mongoose, { mongo, Types } from "mongoose";
import * as dotenv from "dotenv";
import { Invoice } from "../src/models/invoice.schema";

dotenv.config();

const BATCH_SIZE = 500;

interface ILegacyInvoice {
    _id: Types.ObjectId;
    invoiceNumber?: string;
    amount?: unknown;
}

function getArgument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

// Available since Node 18, but not in the ES2020 lib this project compiles against
const supportedCurrencies: string[] = (Intl as unknown as { supportedValuesOf(key: "currency"): string[] }).supportedValuesOf("currency");

function getMinorDigits(currency: string): number {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

// Converts using the number's decimal text, because multiplying is inexact (1.005 * 100 === 100.49999999999999)
export function toMinorUnits(amount: unknown, minorDigits: number): number | null {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return null;
    }

    const text = amount.toString();
    if (/e/i.test(text)) {
        return null;
    }

    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > minorDigits) {
        return null;
    }

    const minorUnits = Number(whole + fraction.padEnd(minorDigits, "0"));
    return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

async function convert(currency: string, minorDigits: number, dryRun: boolean) {
    // Use the raw collection so documents that fail the new schema rules can still be updated
    const cursor = Invoice.collection.find<ILegacyInvoice>(
        { currency: { $exists: false } },
        { projection: { invoiceNumber: 1, amount: 1 } }
    );

    let scanned = 0;
    let converted = 0;
    const skipped: ILegacyInvoice[] = [];
    let batch: mongo.AnyBulkWriteOperation[] = [];

    const flush = async () => {
        if (batch.length === 0) {
            return;
        }
        if (!dryRun) {
            const result = await Invoice.collection.bulkWrite(batch, { ordered: false });
            converted += result.modifiedCount;
        } else {
            converted += batch.length;
        }
        batch = [];
    };

    for await (const invoice of cursor) {
        scanned++;
        const minorUnits = toMinorUnits(invoice.amount, minorDigits);

        if (minorUnits === null) {
            skipped.push(invoice);
            continue;
        }

        if (dryRun && converted + batch.length < 10) {
            console.log(`  ${invoice._id} (invoice ${invoice.invoiceNumber ?? "?"}): ${invoice.amount} -> ${minorUnits} ${currency}`);
        }

        batch.push({
            updateOne: {
                // Match the original amount too, so an invoice changed meanwhile is never converted twice
                filter: { _id: invoice._id, currency: { $exists: false }, amount: invoice.amount },
                update: { $set: { amount: minorUnits, currency } },
            },
        });

        if (batch.length >= BATCH_SIZE) {
            await flush();
        }
    }
    await flush();

    console.log(`${dryRun ? "[dry run] " : ""}Invoices without currency: ${scanned}`);
    console.log(`${dryRun ? "Would convert" : "Converted"}: ${converted}`);

    if (skipped.length > 0) {
        console.log(`Skipped, amount can't be converted exactly with ${minorDigits} decimal places: ${skipped.length}`);
        skipped.forEach((invoice) =>
            console.log(`  - ${invoice._id} (invoice ${invoice.invoiceNumber ?? "?"}, amount ${JSON.stringify(invoice.amount)})`)
        );
    }

    return skipped.length;
}

async function main() {
    if (!process.env.DATABASE_CONNECTION_STRING || !process.env.DATABASE_NAME) {
        console.error("Missing required environment variables: DATABASE_CONNECTION_STRING and DATABASE_NAME");
        process.exit(1);
    }

    const currency = getArgument("--currency")?.toUpperCase();
    if (!currency || !supportedCurrencies.includes(currency)) {
        console.error("Pass the currency the existing amounts are in, e.g. --currency NGN");
        process.exit(1);
    }

    const minorDigitsArgument = getArgument("--minor-digits");
    const minorDigits = minorDigitsArgument === undefined ? getMinorDigits(currency) : Number(minorDigitsArgument);
    if (!Number.isInteger(minorDigits) || minorDigits < 0 || minorDigits > 4) {
        console.error("--minor-digits must be a whole number from 0 to 4");
        process.exit(1);
    }

    const dryRun = process.argv.includes("--dry-run");

    await mongoose.connect(process.env.DATABASE_CONNECTION_STRING, {
        dbName: process.env.DATABASE_NAME,
    });

    // Variables in .env are loaded when not set in the shell, so always show which database is targeted
    const { host, name } = mongoose.connection;
    console.log(`Database: ${name} on ${host}${dryRun ? " (dry run)" : ""}`);
    console.log(`Currency: ${currency}, ${minorDigits} decimal places (1 ${currency} = ${10 ** minorDigits} minor units)`);

    try {
        const skipped = await convert(currency, minorDigits, dryRun);
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
