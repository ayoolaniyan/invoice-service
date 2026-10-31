import { injectable } from "inversify";
import { Model } from "mongoose";
import { ICompany, IPartialCompanyWithId } from "./../models/company.interface";
import { Company } from "./../models/company.schema";
import { buildPaginationMeta, IPaginatedResult, IPagination, resolvePagination } from "./../models/pagination.interface";
import { NotFoundError } from "../errors/app.error";


@injectable()
export class CompanyService {
    private companyModel: Model<ICompany> = Company;

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
