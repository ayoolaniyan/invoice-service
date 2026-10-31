import { checkSchema } from "express-validator";

// express-validator runs most checks on each item of an array, so ["draft"] or ?page=1&page=2
// would pass. Add this to every single-value field that has no isString check.
export function singleValue(label: string) {
    return {
        isArray: {
            negated: true,
            errorMessage: `${label} must be a single value, not a list`,
        },
    };
}

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
        ...singleValue("Page"),
        optional: true,
        isInt: {
            options: { min: 1 },
            errorMessage: "Page must be a positive integer",
        },
        toInt: true,
    },
    limit: {
        in: ["query"],
        ...singleValue("Limit"),
        optional: true,
        isInt: {
            options: { min: 1, max: 100 },
            errorMessage: "Limit must be an integer between 1 and 100",
        },
        toInt: true,
    },
    order: {
        in: ["query"],
        ...singleValue("Order"),
        optional: true,
        isIn: {
            options: [["asc", "desc"]],
            errorMessage: "Order must be either 'asc' or 'desc'",
        },
    },
});
