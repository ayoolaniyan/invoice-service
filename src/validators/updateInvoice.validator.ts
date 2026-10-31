import { checkSchema } from "express-validator";
import { INVOICE_STATUSES } from "../models/invoice.interface";

export const updateInvoiceValidator = checkSchema({
    invoiceNumber: {
        in: ["body"],
        optional: true,
        trim: true,
        notEmpty: {
            errorMessage: "Invoice number can not be empty",
        },
        isLength: {
            options: { max: 100 },
            errorMessage: "Invoice number can not be more than 100 characters",
        },
    },
    description: {
        in: ["body"],
        optional: true,
        isString: {
            errorMessage: "Description must be a string",
        },
        trim: true,
    },
    issueDate: {
        in: ["body"],
        optional: true,
        isISO8601: {
            errorMessage: "Invoice issue date must be a valid ISO8601 date",
        },
        toDate: true,
    },
    dueDate: {
        in: ["body"],
        optional: true,
        isISO8601: {
            errorMessage: "Invoice due date must be a valid ISO8601 date",
        },
        toDate: true,
    },
    status: {
        in: ["body"],
        optional: true,
        isIn: {
            options: [INVOICE_STATUSES],
            errorMessage: `Invoice status must be one of: ${INVOICE_STATUSES.join(", ")}`,
        },
    },
    amount: {
        in: ["body"],
        optional: true,
        isInt: {
            options: { min: 0, max: Number.MAX_SAFE_INTEGER },
            errorMessage: "Invoice amount must be a non-negative whole number in the currency's minor unit (e.g. 15050 for 150.50)",
        },
        toInt: true,
    },
    currency: {
        in: ["body"],
        optional: true,
        isString: {
            errorMessage: "Currency must be a string",
        },
        trim: true,
        toUpperCase: true,
        isISO4217: {
            errorMessage: "Currency must be a valid ISO 4217 code, e.g. NGN or USD",
        },
        // The amount means a different value in another currency, so both must change together
        custom: {
            options: (currency: string, { req }) => req.body.amount !== undefined,
            errorMessage: "Amount must be sent together with currency",
        },
    },
    companyId: {
        in: ["body"],
        optional: true,
        isMongoId: {
            errorMessage: "Company ID must be a valid MongoDB ObjectId",
        },
    },
});
