import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { BadRequestError } from "../errors/app.error";

export function validateRequest(req: Request, res: Response, next: NextFunction) {
    const result = validationResult(req);

    if (!result.isEmpty()) {
        const details = result.array().map((error) => ({
            field: error.type === "field" ? error.path : undefined,
            location: error.type === "field" ? error.location : undefined,
            message: error.msg,
        }));
        return next(new BadRequestError("Validation failed", details));
    }

    next();
}
