import { timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import { ApiKeyRole, getApiKeys, hashApiKey, IApiClient } from "../config/auth.config";
import { ForbiddenError, UnauthorizedError } from "../errors/app.error";

export const API_KEY_HEADER = "X-API-Key";

declare global {
    namespace Express {
        interface Request {
            apiClient?: IApiClient;
        }
    }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.get(API_KEY_HEADER);

    if (!apiKey) {
        return next(new UnauthorizedError(`Missing ${API_KEY_HEADER} header`));
    }

    // Hashing first gives equal-length buffers, so the comparison takes the same time whatever the key
    const hash = hashApiKey(apiKey);
    const match = getApiKeys().find((entry) => timingSafeEqual(entry.hash, hash));

    if (!match) {
        return next(new UnauthorizedError("Invalid API key"));
    }

    req.apiClient = { name: match.name, role: match.role };
    next();
}

export function authorize(requiredRole: ApiKeyRole) {
    return (req: Request, res: Response, next: NextFunction) => {
        const role = req.apiClient?.role;

        if (!role) {
            return next(new UnauthorizedError());
        }
        // "write" keys can do everything "read" keys can
        if (requiredRole === "write" && role !== "write") {
            return next(new ForbiddenError(`This action needs an API key with the "write" role`));
        }

        next();
    };
}
