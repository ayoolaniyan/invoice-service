import { StatusCodes } from "http-status-codes";

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = new.target.name;
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = "Bad request", details?: unknown) {
        super(StatusCodes.BAD_REQUEST, message, details);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = "Resource not found") {
        super(StatusCodes.NOT_FOUND, message);
    }
}

export class ConflictError extends AppError {
    constructor(message: string = "Conflict") {
        super(StatusCodes.CONFLICT, message);
    }
}
