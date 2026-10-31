import pino, { LoggerOptions } from "pino";

function isInstalled(moduleName: string): boolean {
    try {
        require.resolve(moduleName);
        return true;
    } catch {
        return false;
    }
}

function defaultLevel(): string {
    if (process.env.NODE_ENV === "test") {
        return "silent";
    }
    return "info";
}

const options: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? defaultLevel(),
    base: { service: "invoice-service" },
    // Never write credentials to the logs
    redact: {
        paths: ['req.headers["x-api-key"]', "req.headers.authorization", "req.headers.cookie"],
        censor: "[REDACTED]",
    },
};

// Human-readable logs in local development; JSON (one object per line) everywhere else.
// pino-pretty is a dev dependency, so it is only used when it is installed.
if (process.env.NODE_ENV !== "production" && process.stdout.isTTY && isInstalled("pino-pretty")) {
    options.transport = { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname,service" } };
}

export const logger = pino(options);
