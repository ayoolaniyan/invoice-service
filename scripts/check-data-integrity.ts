/**
 * Read-only check for data that breaks the integrity rules, e.g. before deploying the
 * unique indexes (the app won't start while duplicates block them). Reports:
 *   - invoice numbers and company registration numbers used more than once (ignoring case)
 *   - invoices whose company no longer exists
 *   - invoices with a status outside the lifecycle
 * Nothing is changed; fix what it lists by hand, then run it again.
 *
 * Usage:
 *   npm run check:data
 */
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { Company } from "../src/models/company.schema";
import { Invoice } from "../src/models/invoice.schema";
import { INVOICE_STATUSES } from "../src/models/invoice.interface";

interface IDuplicate {
    _id: string;
    ids: mongoose.Types.ObjectId[];
    values: string[];
}

export interface IIntegrityReport {
    duplicateInvoiceNumbers: IDuplicate[];
    duplicateRegistrationNumbers: IDuplicate[];
    orphanedInvoiceIds: mongoose.Types.ObjectId[];
    invalidStatusInvoiceIds: mongoose.Types.ObjectId[];
}

// Same comparison as the unique indexes: case-insensitive, ignoring surrounding spaces
async function findDuplicates(collection: mongoose.mongo.Collection, field: string): Promise<IDuplicate[]> {
    return collection
        .aggregate<IDuplicate>([
            { $match: { [field]: { $type: "string" } } },
            {
                $group: {
                    _id: { $toLower: { $trim: { input: `$${field}` } } },
                    ids: { $push: "$_id" },
                    values: { $addToSet: `$${field}` },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
            { $sort: { _id: 1 } },
        ])
        .toArray();
}

export async function checkDataIntegrity(): Promise<IIntegrityReport> {
    // Raw collections, so the queries see the stored data as it is
    const invoices = Invoice.collection;
    const companies = Company.collection;

    const [duplicateInvoiceNumbers, duplicateRegistrationNumbers, orphans, invalidStatuses] = await Promise.all([
        findDuplicates(invoices, "invoiceNumber"),
        findDuplicates(companies, "registrationNumber"),
        invoices
            .aggregate<{ _id: mongoose.Types.ObjectId }>([
                { $lookup: { from: companies.collectionName, localField: "companyId", foreignField: "_id", as: "company" } },
                { $match: { company: { $size: 0 } } },
                { $project: { _id: 1 } },
            ])
            .toArray(),
        invoices
            .find<{ _id: mongoose.Types.ObjectId }>({ status: { $nin: [...INVOICE_STATUSES] } }, { projection: { _id: 1 } })
            .toArray(),
    ]);

    return {
        duplicateInvoiceNumbers,
        duplicateRegistrationNumbers,
        orphanedInvoiceIds: orphans.map((invoice) => invoice._id),
        invalidStatusInvoiceIds: invalidStatuses.map((invoice) => invoice._id),
    };
}

function printReport(report: IIntegrityReport): number {
    let problems = 0;

    const section = (title: string, lines: string[]) => {
        console.log(`${title}: ${lines.length === 0 ? "none" : lines.length}`);
        lines.forEach((line) => console.log(`  - ${line}`));
        problems += lines.length;
    };

    section(
        "Duplicate invoice numbers",
        report.duplicateInvoiceNumbers.map((d) => `${d.values.join(" / ")} (invoices ${d.ids.join(", ")})`)
    );
    section(
        "Duplicate company registration numbers",
        report.duplicateRegistrationNumbers.map((d) => `${d.values.join(" / ")} (companies ${d.ids.join(", ")})`)
    );
    section("Invoices whose company doesn't exist", report.orphanedInvoiceIds.map(String));
    section(`Invoices with a status other than ${INVOICE_STATUSES.join(", ")}`, report.invalidStatusInvoiceIds.map(String));

    return problems;
}

async function main() {
    dotenv.config();

    if (!process.env.DATABASE_CONNECTION_STRING || !process.env.DATABASE_NAME) {
        console.error("Missing required environment variables: DATABASE_CONNECTION_STRING and DATABASE_NAME");
        process.exit(1);
    }

    await mongoose.connect(process.env.DATABASE_CONNECTION_STRING, {
        dbName: process.env.DATABASE_NAME,
        // Indexes are built by the app at startup; this script reports what would block them
        autoIndex: false,
    });

    const { host, name } = mongoose.connection;
    console.log(`Database: ${name} on ${host} (read-only)`);

    try {
        const problems = printReport(await checkDataIntegrity());
        console.log(problems === 0 ? "No problems found." : `${problems} problem(s) found.`);
        process.exitCode = problems > 0 ? 2 : 0;
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
