import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { ensureIndexes } from "../../src/config/database.config";

/**
 * Each test file gets its own database, so files can run in parallel without seeing each other's data.
 * Indexes are built the same way the app builds them at startup; pass `indexes: false` to test data
 * that the unique indexes would reject (e.g. migrations of old records).
 */
export async function connectTestDatabase({ indexes = true }: { indexes?: boolean } = {}) {
    const uri = process.env.TEST_MONGO_URI;
    if (!uri) {
        throw new Error("TEST_MONGO_URI is not set; integration tests must run through the Jest globalSetup");
    }
    await mongoose.connect(uri, { dbName: `test_${randomUUID().replace(/-/g, "")}`, autoIndex: false });

    if (indexes) {
        await ensureIndexes();
    }
}

export async function clearTestDatabase() {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDatabase() {
    if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
        await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
}
