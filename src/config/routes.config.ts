import { Application } from "express";
import { container } from "./container.config";
import { CompanyRouter } from "./../routes/company.router";
import { InvoiceRouter } from "./../routes/invoice.router";
import { authenticate } from "../middlewares/auth";

export const API_PREFIX = "/api/v1";

export function addRoutes(app: Application): Application {
    const invoiceRouter: InvoiceRouter = container.get<InvoiceRouter>(InvoiceRouter);
    const companyRouter: CompanyRouter = container.get<CompanyRouter>(CompanyRouter);

    // Every API route needs a valid API key; each route then checks the key's role
    app.use(API_PREFIX, authenticate);

    app.use(`${API_PREFIX}/invoices`, invoiceRouter.router);
    app.use(`${API_PREFIX}/companies`, companyRouter.router);

    return app;
}
