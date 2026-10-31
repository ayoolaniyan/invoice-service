import { CorsOptions } from "cors";
import { API_KEY_HEADER } from "../middlewares/auth";

function splitList(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * Browsers may only call the API from origins listed in CORS_ORIGINS (comma-separated,
 * e.g. "https://app.example.com,http://localhost:5173"). With none listed, cross-origin
 * browser requests are refused. Server-to-server calls are not affected by CORS.
 */
export function getCorsOptions(): CorsOptions {
    const allowedOrigins = splitList(process.env.CORS_ORIGINS);

    return {
        origin: allowedOrigins.length > 0 ? allowedOrigins : false,
        methods: ["GET", "POST", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", API_KEY_HEADER],
        exposedHeaders: ["Location", "RateLimit", "RateLimit-Policy", "Retry-After"],
        maxAge: 600,
    };
}

/**
 * TRUST_PROXY tells Express how many proxies (load balancer, ingress) sit in front of the app,
 * so req.ip, and therefore rate limiting, uses the real client IP. Leave it unset when the
 * app is reached directly; otherwise every client behind one proxy shares a single limit.
 */
export function getTrustProxy(): number | string | false {
    const value = process.env.TRUST_PROXY?.trim();

    if (!value || value === "false") {
        return false;
    }

    return /^\d+$/.test(value) ? Number(value) : value;
}

// API docs are on by default outside production; set ENABLE_API_DOCS=true or false to override
export function isApiDocsEnabled(): boolean {
    const value = process.env.ENABLE_API_DOCS?.trim().toLowerCase();

    if (value === "true" || value === "false") {
        return value === "true";
    }

    return process.env.NODE_ENV !== "production";
}
