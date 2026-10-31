import { checkSchema } from "express-validator";
import { singleValue } from "./common.validator";

export const updateCompanyValidator = checkSchema({
    name: {
        in: ["body"],
        optional: true,
        isString: {
            errorMessage: "Company name must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company name can not be empty",
        },
        isLength: {
            options: { max: 100 },
            errorMessage: "Company name can not be more than 100 characters",
        },
    },
    email: {
        in: ["body"],
        ...singleValue("Company email"),
        optional: true,
        trim: true,
        isEmail: {
            errorMessage: "Company email must be a valid email address",
        },
    },
    phone: {
        in: ["body"],
        optional: true,
        isString: {
            errorMessage: "Company phone must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company phone can not be empty",
        },
    },
    address: {
        in: ["body"],
        optional: true,
        isString: {
            errorMessage: "Company address must be a string",
        },
        trim: true,
        notEmpty: {
            errorMessage: "Company address can not be empty",
        },
    },
});
