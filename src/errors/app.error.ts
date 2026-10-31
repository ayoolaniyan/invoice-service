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

export class UnauthorizedError extends AppError {
    constructor(message: string = "Authentication required") {
        super(StatusCodes.UNAUTHORIZED, message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "You do not have permission to perform this action") {
        super(StatusCodes.FORBIDDEN, message);
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message: string = "Too many requests, please try again later") {
        super(StatusCodes.TOO_MANY_REQUESTS, message);
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
