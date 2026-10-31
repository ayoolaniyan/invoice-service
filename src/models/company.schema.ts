import { model, Model, Schema } from "mongoose";
import { ICompany } from "./company.interface";

const companySchema: Schema<ICompany> = new Schema(
    {
        name: {
            type: String,
            required: [true, "Company name is required"],
            trim: true,
            maxlength: [100, "Company name can not be more than 100 characters."]
        },
        registrationNumber: {
            type: String,
            required: [true, "Company registration number is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Company email is required"],
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: [true, "Company phone is required"],
            trim: true
        },
        address: {
            type: String,
            required: [true, "Company address is required"],
        }
    },
    { timestamps: true }
);

export const Company: Model<ICompany> = model("Company", companySchema);
