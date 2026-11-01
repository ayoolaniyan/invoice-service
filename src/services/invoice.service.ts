import { injectable } from "inversify";
import mongoose, { Model } from "mongoose";
import { ICreateInvoice, IInvoice, IPartialInvoiceWithId } from "../models/invoice.interface";
import { Invoice } from "../models/invoice.schema";
import { canTransition, DELETABLE_INVOICE_STATUSES, INVOICE_STATUS_TRANSITIONS, isFinalStatus } from "../models/invoiceStatus";
import { ICompany } from "../models/company.interface";
import { Company } from "../models/company.schema";
import { buildPaginationMeta, IPaginatedResult, IPagination, resolvePagination } from "../models/pagination.interface";
import { ConflictError, NotFoundError } from "../errors/app.error";

@injectable()
export class InvoiceService {
    private invoiceModel: Model<IInvoice> = Invoice;
    private companyModel: Model<ICompany> = Company;

    private async getCompanySnapshot(companyId: string) {
        const company = await this.companyModel.findById(companyId);

        if (!company) {
            throw new NotFoundError(`Company with ID ${companyId} not found`);
        }

        return {
            companyId: company._id,
            companyName: company.name,
            companyRegistrationNumber: company.registrationNumber,
        };
    }

    public async createInvoice(data: ICreateInvoice) {
        const companySnapshot = await this.getCompanySnapshot(data.companyId);

        const invoice = new this.invoiceModel({
            ...data,
            ...companySnapshot,
        });

        return await invoice.save();
    }

    public async getInvoicesById(_id: string) {
        const invoice = await this.invoiceModel.findById(_id);
        if (!invoice) {
            throw new NotFoundError(`Invoice with ID ${_id} not found`);
        }
        return invoice;
    }

    public async updateInvoice(invoicesData: IPartialInvoiceWithId) {
        const { _id, companyId, ...updateData } = invoicesData;

        const invoice = await this.getInvoicesById(_id);

        if (isFinalStatus(invoice.status)) {
            throw new ConflictError(`Invoice is ${invoice.status} and can no longer be changed`);
        }

        const newStatus = updateData.status;
        if (newStatus && newStatus !== invoice.status && !canTransition(invoice.status, newStatus)) {
            const allowed = INVOICE_STATUS_TRANSITIONS[invoice.status].join(", ");
            throw new ConflictError(`Invoice status can't change from ${invoice.status} to ${newStatus}. Allowed: ${allowed}`);
        }

        invoice.set(updateData);

        if (companyId) {
            invoice.set(await this.getCompanySnapshot(companyId));
        }

        // save() (unlike findByIdAndUpdate) runs validators that compare fields, e.g. dueDate >= issueDate,
        // and fails if another request changed the invoice since it was loaded (optimistic concurrency)
        return await invoice.save();
    }

    public async deleteInvoice(_id: string) {
        // Check the status in the delete itself, so an invoice issued in the meantime is never deleted
        const deletedInvoice = await this.invoiceModel.findOneAndDelete({
            _id,
            status: mongoose.trusted({ $in: DELETABLE_INVOICE_STATUSES }),
        });

        if (!deletedInvoice) {
            const invoice = await this.getInvoicesById(_id);
            throw new ConflictError(`Invoice is ${invoice.status} and can't be deleted. Only draft invoices can be deleted; cancel issued invoices instead.`);
        }

        return deletedInvoice;
    }

    public async getInvoices(pagination: IPagination) {
        return await this.invoiceModel
            .find()
            .limit(pagination.limit)
            .skip((pagination.page - 1) * pagination.limit)
            .sort({
                createdAt: pagination.order === "asc" ? 1 : -1,
            });
    }

    public async findInvoices(pagination: Partial<IPagination>): Promise<IPaginatedResult<IInvoice>> {
        const resolvedPagination = resolvePagination(pagination);

        const [invoices, total] = await Promise.all([
            this.getInvoices(resolvedPagination),
            this.invoiceModel.countDocuments(),
        ]);

        return {
            data: invoices,
            meta: buildPaginationMeta(resolvedPagination, total),
        };
    }
}
