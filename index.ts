// Must be first so every module below sees the variables from .env
import "dotenv/config";
import { Server } from "http";
import mongoose from "mongoose";
import { createApp } from "./src/app";
import { getApiKeys } from "./src/config/auth.config";
import { ensureIndexes } from "./src/config/database.config";
import { logger } from "./src/config/logger.config";
import { markShuttingDown } from "./src/routes/health.router";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

function validateEnvironment() {
    const missing = ["DATABASE_CONNECTION_STRING", "DATABASE_NAME", "PORT"].filter((name) => !process.env[name]);
    if (missing.length > 0) {
        logger.fatal({ missing }, "Missing required environment variables");
        process.exit(1);
    }

    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        logger.fatal({ port: process.env.PORT }, "PORT must be a whole number from 1 to 65535");
        process.exit(1);
    }

    try {
        const apiKeys = getApiKeys();
        logger.info({ apiKeys: apiKeys.map((key) => `${key.name} (${key.role})`) }, "Loaded API keys");
    } catch (error) {
        logger.fatal({ reason: (error as Error).message }, "Invalid API_KEYS");
        process.exit(1);
    }

    return port;
}

async function shutdown(signal: string) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    markShuttingDown();
    logger.info({ signal }, "Shutting down: no longer accepting new connections");

    // If open requests don't finish in time, exit anyway so the orchestrator can restart us
    const forceExit = setTimeout(() => {
        logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "Shutdown timed out, forcing exit");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
        if (server) {
            await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
        }
        await mongoose.disconnect();
        logger.info("Shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error({ err: error }, "Error during shutdown");
        process.exit(1);
    }
}

async function bootstrap() {
    const port = validateEnvironment();

    mongoose.connection.on("disconnected", () => {
        if (!shuttingDown) {
            logger.warn("Lost connection to MongoDB, retrying");
        }
    });
    mongoose.connection.on("reconnected", () => logger.info("Reconnected to MongoDB"));

    try {
        await mongoose.connect(process.env.DATABASE_CONNECTION_STRING!, {
            dbName: process.env.DATABASE_NAME,
            // Built explicitly below, so a failure stops startup instead of being ignored
            autoIndex: false,
        });
        logger.info({ database: mongoose.connection.name }, "Connected to MongoDB");
    } catch (error) {
        logger.fatal({ err: error }, "Could not connect to MongoDB");
        process.exit(1);
    }

    try {
        await ensureIndexes();
    } catch (error) {
        // Usually existing duplicates blocking a unique index. Serving without it would let more in.
        logger.fatal({ err: error }, "Could not build database indexes; run `npm run check:data` to find duplicate records");
        process.exit(1);
    }

    server = createApp().listen(port, () => {
        logger.info({ port }, `Server is running at http://localhost:${port}`);
    });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// An unknown error may have left the app in a bad state, so log it and let the orchestrator restart us
process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
});
process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
});

bootstrap();
