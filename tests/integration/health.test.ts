import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import { createApp } from "../../src/app";
import { markShuttingDown } from "../../src/routes/health.router";
import { connectTestDatabase, disconnectTestDatabase } from "../helpers/db";

let app: Express;

beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
});

afterAll(disconnectTestDatabase);

// These run in order: the last ones disconnect the database and mark the app as shutting down
describe("health checks", () => {
    it("GET /health returns 200 without an API key", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ status: "ok" });
        expect(typeof response.body.data.uptime).toBe("number");
    });

    it("GET /ready returns 200 when the database is reachable", async () => {
        const response = await request(app).get("/ready");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ status: "ready", checks: { database: "up", shuttingDown: false } });
    });

    it("GET /ready returns 503 when the database is disconnected", async () => {
        const uri = process.env.TEST_MONGO_URI!;
        const dbName = mongoose.connection.name;
        await mongoose.disconnect();

        const response = await request(app).get("/ready");
        await mongoose.connect(uri, { dbName });

        expect(response.status).toBe(503);
        expect(response.body.error).toEqual({ status: "not ready", checks: { database: "down", shuttingDown: false } });
    });

    it("GET /ready returns 503 while shutting down, while /health stays 200", async () => {
        markShuttingDown();

        const ready = await request(app).get("/ready");
        const health = await request(app).get("/health");

        expect(ready.status).toBe(503);
        expect(ready.body.error.checks).toEqual({ database: "up", shuttingDown: true });
        expect(health.status).toBe(200);
    });
});
