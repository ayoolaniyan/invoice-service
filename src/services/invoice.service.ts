import { injectable } from "inversify";
import { Model } from "mongoose";
import { ICreateInvoice, IInvoice, IPartialInvoiceWithId } from "../models/invoice.interface";
import { Invoice } from "../models/invoice.schema";
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

        invoice.set(updateData);

        if (companyId) {
            invoice.set(await this.getCompanySnapshot(companyId));
        }

        // save() (unlike findByIdAndUpdate) runs validators that compare fields, e.g. dueDate >= issueDate
        return await invoice.save();
    }

    public async deleteInvoice(_id: string) {
        const invoice = await this.getInvoicesById(_id);

        const allowedStatus: Array<IInvoice["status"]> = ["paid", "cancelled", "draft"];
        if (!allowedStatus.includes(invoice.status)) {
            throw new ConflictError(`Invoice with status "${invoice.status}" can not be deleted. Only "paid", "cancelled" and "draft" invoices can be deleted.`);
        }

        const deletedInvoice = await this.invoiceModel.findByIdAndDelete(_id);

        if (!deletedInvoice) {
            throw new NotFoundError(`Invoice with ID ${_id} not found`);
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
