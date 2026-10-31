import { Types } from "mongoose";

export const INVOICE_STATUSES = ["paid", "draft", "overdue", "cancelled", "pending"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice {
    invoiceNumber: string;
    description: string;
    issueDate: Date;
    dueDate: Date;
    status: InvoiceStatus;
    amount: number;
    companyId: Types.ObjectId;
    companyName: string;
    companyRegistrationNumber: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateInvoice {
    invoiceNumber: string;
    description?: string;
    issueDate: Date;
    dueDate: Date;
    status: InvoiceStatus;
    amount: number;
    companyId: string;
}

export interface IUpdateInvoice extends Partial<ICreateInvoice> {}

export interface IPartialInvoiceWithId extends IUpdateInvoice {
    _id: string;
}
