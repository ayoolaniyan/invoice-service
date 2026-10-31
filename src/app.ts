import "reflect-metadata";
import express, { Express } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { responseFormatter } from "./middlewares/responseFormatter";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { createRateLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { addRoutes } from "./config/routes.config";
import { getCorsOptions, getTrustProxy, isApiDocsEnabled } from "./config/security.config";
import { swaggerSpec } from "./config/swagger.config";
import { healthRouter } from "./routes/health.router";

// Treat any "$"-prefixed keys in query filters as literal values, not operators (NoSQL injection)
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export function createApp(): Express {
    const app: Express = express();

    app.set("trust proxy", getTrustProxy());

    // The API serves JSON; the only HTML is the Swagger UI, whose assets would fail to load
    // over plain HTTP (e.g. a staging host without TLS) if requests were upgraded to HTTPS
    app.use(helmet({
        contentSecurityPolicy: {
            directives: { upgradeInsecureRequests: null },
        },
    }));

    app.use(requestLogger);

    // Before anything that can respond, so every JSON response gets the same format
    app.use(responseFormatter);

    // Before CORS and rate limiting, so orchestrator health checks are never blocked
    app.use(healthRouter);

    app.use(cors(getCorsOptions()));

    app.use(createRateLimiter());

    app.use(express.json({ limit: "100kb" }));

    if (isApiDocsEnabled()) {
        app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    }

    addRoutes(app);

    app.use(notFoundHandler);

    app.use(errorHandler);

    return app;
}
