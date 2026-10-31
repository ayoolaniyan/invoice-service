import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import { AppError, NotFoundError } from "../errors/app.error";

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

function isDuplicateKeyError(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
    return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

// Errors raised by body-parser and other http-errors based middleware (e.g. malformed JSON)
function isClientHttpError(err: unknown): err is { status: number; message: string; expose: boolean } {
    if (typeof err !== "object" || err === null) {
        return false;
    }
    const { status, expose } = err as { status?: unknown; expose?: unknown };
    return typeof status === "number" && status >= 400 && status < 500 && expose === true;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message, details: err.details });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: `Invalid value for ${err.path}` });
    }

    if (err instanceof mongoose.Error.ValidationError) {
        const details = Object.values(err.errors).map((error) => ({
            field: error.path,
            message: error.message,
        }));
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "Validation failed", details });
    }

    if (isDuplicateKeyError(err)) {
        const fields = Object.keys(err.keyValue ?? {}).join(", ");
        return res.status(StatusCodes.CONFLICT).json({ message: `Duplicate value for ${fields || "a unique field"}` });
    }

    if (isClientHttpError(err)) {
        return res.status(err.status).json({ message: err.message });
    }

    console.error(err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
}
