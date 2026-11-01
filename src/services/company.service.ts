import { injectable } from "inversify";
import { Model } from "mongoose";
import { ICompany, IPartialCompanyWithId } from "./../models/company.interface";
import { Company } from "./../models/company.schema";
import { IInvoice } from "./../models/invoice.interface";
import { Invoice } from "./../models/invoice.schema";
import { buildPaginationMeta, IPaginatedResult, IPagination, resolvePagination } from "./../models/pagination.interface";
import { ConflictError, NotFoundError } from "../errors/app.error";


@injectable()
export class CompanyService {
    private companyModel: Model<ICompany> = Company;
    private invoiceModel: Model<IInvoice> = Invoice;

    public async createCompany(data: ICompany) {
        return await new this.companyModel(data).save();
    }

    public async getCompanies(pagination: IPagination) {
        return await this.companyModel
            .find()
            .limit(pagination.limit)
            .skip((pagination.page - 1) * pagination.limit)
            .sort({
                createdAt: pagination.order === "asc" ? 1 : -1,
            });
    }

    public async getCompanyById(_id: string) {
        const company = await this.companyModel.findById(_id);
        if (!company) {
            throw new NotFoundError(`Company with ID ${_id} not found`);
        }
        return company;
    }

    public async updateCompany(companyData: IPartialCompanyWithId) {
        const { _id, ...updateData } = companyData;

        const updatedCompany = await this.companyModel.findByIdAndUpdate(
            _id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCompany) {
            throw new NotFoundError(`Company with ID ${_id} not found`);
        }
        return updatedCompany;
    }

    public async deleteCompany(_id: string) {
        // Deleting a company with invoices would leave them pointing at nothing.
        // Without a transaction an invoice could still be created between this check and the
        // delete; closing that gap needs a replica set (for transactions) or soft deletes.
        const invoiceCount = await this.invoiceModel.countDocuments({ companyId: _id });
        if (invoiceCount > 0) {
            throw new ConflictError(`Company has ${invoiceCount} invoice(s) and can't be deleted. Delete or move them to another company first.`);
        }

        const deletedCompany = await this.companyModel.findByIdAndDelete(_id);

        if (!deletedCompany) {
            throw new NotFoundError(`Company with ID ${_id} not found`);
        }

        return deletedCompany;
    }

    public async findCompanies(pagination: Partial<IPagination>): Promise<IPaginatedResult<ICompany>> {
        const resolvedPagination = resolvePagination(pagination);

        const [companies, total] = await Promise.all([
            this.getCompanies(resolvedPagination),
            this.companyModel.countDocuments(),
        ]);

        return {
            data: companies,
            meta: buildPaginationMeta(resolvedPagination, total),
        };
    }
}
