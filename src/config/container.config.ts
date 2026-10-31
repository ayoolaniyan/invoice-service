import "reflect-metadata";
import { Container } from "inversify";
import { CompanyController } from "./../controllers/company.controller";
import { CompanyRouter } from "./../routes/company.router";
import { CompanyService } from "./../services/company.service";
import { InvoiceController } from "../controllers/invoice.controller";
import { InvoiceRouter } from "../routes/invoice.router";
import { InvoiceService } from "../services/invoice.service";

export const container: Container = new Container();

container.bind(InvoiceController).toSelf().inTransientScope();
container.bind(InvoiceRouter).toSelf().inTransientScope();
container.bind(InvoiceService).toSelf().inSingletonScope();

container.bind(CompanyController).toSelf().inTransientScope();
container.bind(CompanyRouter).toSelf().inTransientScope();
container.bind(CompanyService).toSelf().inSingletonScope();
