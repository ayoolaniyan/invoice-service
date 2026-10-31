import { checkSchema } from "express-validator";

export const createCompanyValidator = checkSchema({
    name: {
        in: ["body"],
        isString: {
            errorMessage: "Company name must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company name is required",
        },
        isLength: {
            options: { max: 100 },
            errorMessage: "Company name can not be more than 100 characters",
        },
    },
    registrationNumber: {
        in: ["body"],
        isString: {
            errorMessage: "Company registration number must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company registration number is required",
        },
    },
    email: {
        in: ["body"],
        trim: true,
        isEmail: {
            errorMessage: "Company email must be a valid email address",
        },
    },
    phone: {
        in: ["body"],
        isString: {
            errorMessage: "Company phone must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company phone is required",
        },
    },
    address: {
        in: ["body"],
        isString: {
            errorMessage: "Company address must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company address is required",
        },
    },
});
