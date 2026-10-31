import { model, Model, Schema } from "mongoose";
import { IInvoice, INVOICE_STATUSES } from "./invoice.interface";

const invoiceSchema: Schema<IInvoice> = new Schema(
    {
        invoiceNumber: {
            type: String,
            required: [true, "Invoice number is required"],
            trim: true,
            maxlength: [100, "Invoice number can not be more than 100 characters."]
        },
        description: {
            type: String,
            trim: true,
        },
        issueDate: {
            type: Date,
            required: [true, "Invoice issue date is required"],
        },
        dueDate: {
            type: Date,
            required: [true, "Invoice due date is required"],
            validate: {
                validator: function (this: IInvoice, dueDate: Date): boolean {
                    return !this.issueDate || dueDate >= this.issueDate;
                },
                message: "Due date can not be before issue date",
            },
        },
        status: {
            type: String,
            required: [true, "Invoice status is required"],
            enum: {
                values: INVOICE_STATUSES,
                message: "{VALUE} is not a valid invoice status",
            },
            trim: true
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: [0, "Amount can not be negative"],
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: [true, "Company ID is required"],
        },
        companyName: {
            type: String,
            required: [true, "Company name is required"],
            trim: true
        },
        companyRegistrationNumber: {
            type: String,
            required: [true, "Company registration number is required"],
            trim: true
        }
    },
    { timestamps: true }
);

export const Invoice: Model<IInvoice> = model("Invoice", invoiceSchema);
