import { Application } from "express";
import { container } from "./container.config";
import { CompanyRouter } from "./../routes/company.router";
import { InvoiceRouter } from "./../routes/invoice.router";

export const API_PREFIX = "/api/v1";

export function addRoutes(app: Application): Application {
    const invoiceRouter: InvoiceRouter = container.get<InvoiceRouter>(InvoiceRouter);
    const companyRouter: CompanyRouter = container.get<CompanyRouter>(CompanyRouter);

    app.use(`${API_PREFIX}/invoices`, invoiceRouter.router);
    app.use(`${API_PREFIX}/companies`, companyRouter.router);

    return app;
}
