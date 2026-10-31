// Must be first so every module below sees the variables from .env
import "dotenv/config";
import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import { responseFormatter } from "./src/middlewares/responseFormatter";
import { errorHandler, notFoundHandler } from "./src/middlewares/errorHandler";
import { createRateLimiter } from "./src/middlewares/rateLimiter";
import morgan from "morgan";
import { addRoutes } from "./src/config/routes.config";
import { getApiKeys } from "./src/config/auth.config";
import { getCorsOptions, getTrustProxy, isApiDocsEnabled } from "./src/config/security.config";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './src/config/swagger.config';

// Treat any "$"-prefixed keys in query filters as literal values, not operators (NoSQL injection)
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const app: Express = express();

app.set("trust proxy", getTrustProxy());

// The API serves JSON; the only HTML is the Swagger UI, whose assets would fail to load
// over plain HTTP (e.g. a staging host without TLS) if requests were upgraded to HTTPS
app.use(helmet({
    contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: null },
    },
}));

app.use(morgan('dev'));

// Before anything that can respond, so every JSON response gets the same format
app.use(responseFormatter);

app.use(cors(getCorsOptions()));

app.use(createRateLimiter());

app.use(express.json({ limit: "100kb" }));

if (isApiDocsEnabled()) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.get("/", (req: Request, res: Response) => {
    res.send("Express + TypeScript Server");
});

addRoutes(app);

app.use(notFoundHandler);

app.use(errorHandler);

async function bootstrap() {
    if (!process.env.DATABASE_CONNECTION_STRING || !process.env.DATABASE_NAME || !process.env.PORT) {
        console.error("Missing required environment variables: DATABASE_CONNECTION_STRING, DATABASE_NAME and PORT");
        process.exit(1);
    }

    try {
        const apiKeys = getApiKeys();
        console.log(`Loaded ${apiKeys.length} API key(s): ${apiKeys.map((key) => `${key.name} (${key.role})`).join(", ")}`);
    } catch (error) {
        console.error(`Invalid API_KEYS: ${(error as Error).message}`);
        process.exit(1);
    }

    try {
        await mongoose.connect(
            process.env.DATABASE_CONNECTION_STRING,
            {
                dbName: process.env.DATABASE_NAME,
            }
        );
        console.log("Connected to MongoDB");
        const port = process.env.PORT;
        app.listen(port, () => {
            console.log(`[server]: Server is running at http://localhost:${port}`);
        });
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

bootstrap();
