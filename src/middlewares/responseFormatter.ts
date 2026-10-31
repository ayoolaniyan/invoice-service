import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";

interface IResponse {
    status: "success" | "error";
    statusCode: number;
    message: string;
    data?: any;
    error?: any;
    meta?: any;
}

export function responseFormatter(
    req: Request,
    res: Response,
    next: NextFunction
) {

    const result = res.json.bind(res);

    res.json = (data: any): Response => {
        const statusCode = res.statusCode ? res.statusCode : StatusCodes.OK;
        const isError = statusCode >= StatusCodes.BAD_REQUEST;

        const response: IResponse = {
            status: isError ? "error" : "success",
            statusCode: statusCode,
            message: getReasonPhrase(statusCode),
        };

        if (isError) {
            response.error = data;
        } else if (data?.meta) {
            response.data = data.data;
            response.meta = data.meta;
        } else {
            response.data = data;
        }

        return result(response);
    };

    next();
}
