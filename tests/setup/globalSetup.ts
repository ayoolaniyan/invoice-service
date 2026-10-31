import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
    var __MONGO_SERVER__: MongoMemoryServer | undefined;
}

export default async function globalSetup() {
    const server = await MongoMemoryServer.create();
    globalThis.__MONGO_SERVER__ = server;
    // Test workers start after this and inherit the variable
    process.env.TEST_MONGO_URI = server.getUri();
}
