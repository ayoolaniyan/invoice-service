import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";

interface IResponse {
    status: "success" | "error";
    statusCode: number;
    message: string;
    data?: unknown;
    error?: unknown;
    meta?: unknown;
}

interface IPaginatedBody {
    data: unknown;
    meta: unknown;
}

function isPaginated(body: unknown): body is IPaginatedBody {
    return typeof body === "object" && body !== null && "meta" in body && Boolean((body as IPaginatedBody).meta);
}

export function responseFormatter(
    req: Request,
    res: Response,
    next: NextFunction
) {

    const result = res.json.bind(res);

    res.json = (data: unknown): Response => {
        const statusCode = res.statusCode ? res.statusCode : StatusCodes.OK;
        const isError = statusCode >= StatusCodes.BAD_REQUEST;

        const response: IResponse = {
            status: isError ? "error" : "success",
            statusCode: statusCode,
            message: getReasonPhrase(statusCode),
        };

        if (isError) {
            response.error = data;
        } else if (isPaginated(data)) {
            response.data = data.data;
            response.meta = data.meta;
        } else {
            response.data = data;
        }

        return result(response);
    };

    next();
}
