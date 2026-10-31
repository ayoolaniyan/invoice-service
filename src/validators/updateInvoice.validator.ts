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
        isFloat: {
            options: { min: 0 },
            errorMessage: "Invoice amount must be a non-negative number",
        },
        toFloat: true,
    },
    companyId: {
        in: ["body"],
        optional: true,
        isMongoId: {
            errorMessage: "Company ID must be a valid MongoDB ObjectId",
        },
    },
});
