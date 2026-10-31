import { checkSchema } from "express-validator";

export const idParamValidator = checkSchema({
    id: {
        in: ["params"],
        isMongoId: {
            errorMessage: "ID must be a valid MongoDB ObjectId",
        },
    },
});

export const paginationValidator = checkSchema({
    page: {
        in: ["query"],
        optional: true,
        isInt: {
            options: { min: 1 },
            errorMessage: "Page must be a positive integer",
        },
        toInt: true,
    },
    limit: {
        in: ["query"],
        optional: true,
        isInt: {
            options: { min: 1, max: 100 },
            errorMessage: "Limit must be an integer between 1 and 100",
        },
        toInt: true,
    },
    order: {
        in: ["query"],
        optional: true,
        isIn: {
            options: [["asc", "desc"]],
            errorMessage: "Order must be either 'asc' or 'desc'",
        },
    },
});
