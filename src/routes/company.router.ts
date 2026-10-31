import { inject } from "inversify";
import express, { Request, Response, Router } from "express";
import { CompanyController } from "./../controllers/company.controller";
import { StatusCodes } from "http-status-codes";
import { createCompanyValidator } from "./../validators/createCompany.validator";
import { updateCompanyValidator } from "../validators/updateCompany.validator";
import { idParamValidator, paginationValidator } from "../validators/common.validator";
import { validateRequest } from "../middlewares/validateRequest";

export class CompanyRouter {
    public router: Router;

    constructor(
        @inject(CompanyController) private companyController: CompanyController
    ) {
        this.router = express.Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {

        this.router.post(
            "/create",
            createCompanyValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const newCompany = await this.companyController.handlePostCompany(req);
                res.status(StatusCodes.CREATED).json(newCompany);
            }
        );

        this.router.put(
            "/update/:id",
            idParamValidator,
            updateCompanyValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const updatedCompany = await this.companyController.handleUpdateCompany(req);
                res.status(StatusCodes.OK).json(updatedCompany);
            }
        );

        this.router.get(
            "/",
            paginationValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const allCompanies = await this.companyController.handleGetCompanies(req);
                res.json(allCompanies);
            }
        );

        this.router.get(
            "/:id",
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const company = await this.companyController.handleGetCompany(req);
                res.status(StatusCodes.OK).json(company);
            }
        );

        this.router.delete(
            "/delete/:id",
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const deletedCompany = await this.companyController.handleDeleteCompany(req);
                res.status(StatusCodes.OK).json({
                    message: "Company deleted successfully",
                    company: deletedCompany
                });
            }
        );

    }
}
