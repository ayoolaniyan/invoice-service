import { inject, injectable } from "inversify";
import express, { Request, Response, Router } from "express";
import { CompanyController } from "./../controllers/company.controller";
import { StatusCodes } from "http-status-codes";
import { createCompanyValidator } from "./../validators/createCompany.validator";
import { updateCompanyValidator } from "../validators/updateCompany.validator";
import { idParamValidator, paginationValidator } from "../validators/common.validator";
import { validateRequest } from "../middlewares/validateRequest";
import { authorize } from "../middlewares/auth";

@injectable()
export class CompanyRouter {
    public router: Router;

    constructor(
        @inject(CompanyController) private companyController: CompanyController
    ) {
        this.router = express.Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {

        /**
         * @swagger
         * /companies:
         *   post:
         *     summary: Create a new company
         *     tags: [Companies]
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/CreateCompanyInput'
         *     responses:
         *       201:
         *         description: Company created
         *         headers:
         *           Location:
         *             description: URL of the new company
         *             schema:
         *               type: string
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/CompanyResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       409:
         *         $ref: '#/components/responses/Conflict'
         */
        this.router.post(
            "/",
            authorize("write"),
            createCompanyValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const newCompany = await this.companyController.handlePostCompany(req);
                res.location(`${req.baseUrl}/${newCompany._id}`);
                res.status(StatusCodes.CREATED).json(newCompany);
            }
        );

        /**
         * @swagger
         * /companies:
         *   get:
         *     summary: List companies
         *     tags: [Companies]
         *     parameters:
         *       - $ref: '#/components/parameters/Page'
         *       - $ref: '#/components/parameters/Limit'
         *       - $ref: '#/components/parameters/Order'
         *     responses:
         *       200:
         *         description: A page of companies
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/CompanyListResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         */
        this.router.get(
            "/",
            authorize("read"),
            paginationValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const companies = await this.companyController.handleGetCompanies(req);
                res.status(StatusCodes.OK).json(companies);
            }
        );

        /**
         * @swagger
         * /companies/{id}:
         *   get:
         *     summary: Get a company by ID
         *     tags: [Companies]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     responses:
         *       200:
         *         description: The company
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/CompanyResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       404:
         *         $ref: '#/components/responses/NotFound'
         */
        this.router.get(
            "/:id",
            authorize("read"),
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const company = await this.companyController.handleGetCompany(req);
                res.status(StatusCodes.OK).json(company);
            }
        );

        /**
         * @swagger
         * /companies/{id}:
         *   patch:
         *     summary: Update a company
         *     description: Only the fields sent are changed. The registration number can not be changed.
         *     tags: [Companies]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/UpdateCompanyInput'
         *     responses:
         *       200:
         *         description: The updated company
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/CompanyResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       404:
         *         $ref: '#/components/responses/NotFound'
         */
        this.router.patch(
            "/:id",
            authorize("write"),
            idParamValidator,
            updateCompanyValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const updatedCompany = await this.companyController.handleUpdateCompany(req);
                res.status(StatusCodes.OK).json(updatedCompany);
            }
        );

        /**
         * @swagger
         * /companies/{id}:
         *   delete:
         *     summary: Delete a company
         *     description: A company that still has invoices can't be deleted.
         *     tags: [Companies]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     responses:
         *       204:
         *         description: Company deleted
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       404:
         *         $ref: '#/components/responses/NotFound'
         *       409:
         *         $ref: '#/components/responses/Conflict'
         */
        this.router.delete(
            "/:id",
            authorize("write"),
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                await this.companyController.handleDeleteCompany(req);
                res.status(StatusCodes.NO_CONTENT).end();
            }
        );

    }
}
