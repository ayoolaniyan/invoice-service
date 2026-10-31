import express, { Request, Response, Router } from "express";
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

const DATABASE_PING_TIMEOUT_MS = 2000;

let shuttingDown = false;

// Called on SIGTERM so load balancers stop sending traffic before the server closes
export function markShuttingDown() {
    shuttingDown = true;
}

async function isDatabaseUp(): Promise<boolean> {
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) {
        return false;
    }

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), DATABASE_PING_TIMEOUT_MS);
    });

    try {
        return await Promise.race([db.admin().ping().then(() => true), timeout]);
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export const healthRouter: Router = express.Router();

// Liveness: the process is running and can handle requests
healthRouter.get("/health", (req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ status: "ok", uptime: Math.round(process.uptime()) });
});

// Readiness: the app can serve traffic (database reachable, not shutting down)
healthRouter.get("/ready", async (req: Request, res: Response) => {
    const database = (await isDatabaseUp()) ? "up" : "down";
    const ready = database === "up" && !shuttingDown;

    res.status(ready ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
        status: ready ? "ready" : "not ready",
        checks: { database, shuttingDown },
    });
});
