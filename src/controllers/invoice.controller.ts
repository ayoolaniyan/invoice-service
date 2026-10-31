import { inject } from "inversify";
import { InvoiceService } from "../services/invoice.service";
import { ICreateInvoice, IInvoice, IUpdateInvoice } from "../models/invoice.interface";
import { IPaginatedResult, IPagination } from "../models/pagination.interface";
import { matchedData } from "express-validator";
import { Request } from "express";
import { Document } from "mongoose";

export class InvoiceController {
    constructor(
        @inject(InvoiceService) private invoiceService: InvoiceService,
    ) { }

    public async handlePostInvoice(req: Request): Promise<Document> {
        const validatedData = matchedData<ICreateInvoice>(req, { locations: ["body"] });
        return await this.invoiceService.createInvoice(validatedData);
    }

    public async handleGetInvoices(req: Request): Promise<IPaginatedResult<IInvoice>> {
        const pagination = matchedData<Partial<IPagination>>(req, { locations: ["query"] });
        return await this.invoiceService.findInvoices(pagination);
    }

    public async handleGetInvoice(req: Request<{ id: string }>): Promise<Document> {
        return await this.invoiceService.getInvoicesById(req.params.id);
    }

    public async handleUpdateInvoice(req: Request<{ id: string }>): Promise<Document> {
        const updateData = matchedData<IUpdateInvoice>(req, { locations: ["body"] });
        return await this.invoiceService.updateInvoice({
            _id: req.params.id,
            ...updateData
        });
    }

    public async handleDeleteInvoice(req: Request<{ id: string }>): Promise<Document> {
        return await this.invoiceService.deleteInvoice(req.params.id);
    }
}
