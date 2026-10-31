import { randomUUID } from "crypto";
import { IncomingMessage, ServerResponse } from "http";
import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.config";

export const REQUEST_ID_HEADER = "X-Request-Id";

// Reuse an incoming request ID (e.g. from a load balancer) so one ID follows the request across services
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function getRequestId(req: IncomingMessage, res: ServerResponse): string {
    const incoming = req.headers[REQUEST_ID_HEADER.toLowerCase()];
    const requestId = typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    return requestId;
}

export const requestLogger = pinoHttp({
    logger,
    genReqId: getRequestId,
    customLogLevel: (req, res, error) => {
        if (error || res.statusCode >= 500) {
            return "error";
        }
        if (res.statusCode >= 400) {
            return "warn";
        }
        return "info";
    },
    // Keep request logs small: the full header set is noisy and may contain sensitive values
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            userAgent: req.headers["user-agent"],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
    },
    customProps: (req) => ({ apiClient: (req as { apiClient?: { name: string } }).apiClient?.name }),
});
