import { Company } from "../models/company.schema";
import { Invoice } from "../models/invoice.schema";

/**
 * Builds the schema indexes, including the unique ones, and fails if it can't.
 *
 * Connections use `autoIndex: false`: Mongoose's automatic index build runs in the
 * background and doesn't fail anything, so existing duplicates would leave the app running
 * without its uniqueness guarantees. The app calls this at startup instead, and
 * `npm run check:data` lists any duplicates that make it fail.
 */
export async function ensureIndexes(): Promise<void> {
    await Promise.all([Company.createIndexes(), Invoice.createIndexes()]);
}
