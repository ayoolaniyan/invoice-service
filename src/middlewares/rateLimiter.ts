import { rateLimit } from "express-rate-limit";
import { TooManyRequestsError } from "../errors/app.error";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function readPositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Limits by client IP. Runs before authentication, so it also slows down API key guessing.
export function createRateLimiter() {
    return rateLimit({
        windowMs: readPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES),
        limit: readPositiveInteger(process.env.RATE_LIMIT_MAX, 300),
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (req, res, next) => next(new TooManyRequestsError()),
    });
}
