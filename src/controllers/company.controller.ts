import { inject, injectable } from "inversify";
import { ICompany } from "./../models/company.interface";
import { IPaginatedResult, IPagination } from "./../models/pagination.interface";
import { Request } from "express";
import { matchedData } from "express-validator";
import { CompanyService } from "./../services/company.service";
import { Document } from "mongoose";

@injectable()
export class CompanyController {
    constructor(
        @inject(CompanyService) private companyService: CompanyService,
    ) { }

    public async handlePostCompany(req: Request): Promise<Document> {
        const validatedData = matchedData<ICompany>(req, { locations: ["body"] });
        return await this.companyService.createCompany(validatedData);
    }

    public async handleGetCompanies(req: Request): Promise<IPaginatedResult<ICompany>> {
        const pagination = matchedData<Partial<IPagination>>(req, { locations: ["query"] });
        return await this.companyService.findCompanies(pagination);
    }

    public async handleGetCompany(req: Request<{ id: string }>): Promise<Document> {
        return await this.companyService.getCompanyById(req.params.id);
    }

    public async handleUpdateCompany(req: Request<{ id: string }>): Promise<Document> {
        const updateData = matchedData<Partial<ICompany>>(req, { locations: ["body"] });
        return await this.companyService.updateCompany({
            _id: req.params.id,
            ...updateData
        });
    }

    public async handleDeleteCompany(req: Request<{ id: string }>): Promise<Document> {
        return await this.companyService.deleteCompany(req.params.id);
    }
}
