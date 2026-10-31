import { inject } from "inversify";
import express, { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import { InvoiceController } from "../controllers/invoice.controller";
import { createInvoiceValidator } from "../validators/createInvoice.validator";
import { updateInvoiceValidator } from "../validators/updateInvoice.validator";
import { idParamValidator, paginationValidator } from "../validators/common.validator";
import { validateRequest } from "../middlewares/validateRequest";
import { authorize } from "../middlewares/auth";


export class InvoiceRouter {
    public router: Router;

    constructor(
        @inject(InvoiceController) private invoiceController: InvoiceController
    ) {
        this.router = express.Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {

        /**
         * @swagger
         * /invoices:
         *   post:
         *     summary: Create a new invoice
         *     tags: [Invoices]
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/CreateInvoiceInput'
         *     responses:
         *       201:
         *         description: Invoice created
         *         headers:
         *           Location:
         *             description: URL of the new invoice
         *             schema:
         *               type: string
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/InvoiceResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       404:
         *         description: Company not found
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/ErrorResponse'
         */
        this.router.post(
            "/",
            authorize("write"),
            createInvoiceValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const newInvoice = await this.invoiceController.handlePostInvoice(req);
                res.location(`${req.baseUrl}/${newInvoice._id}`);
                res.status(StatusCodes.CREATED).json(newInvoice);
            }
        );

        /**
         * @swagger
         * /invoices:
         *   get:
         *     summary: List invoices
         *     tags: [Invoices]
         *     parameters:
         *       - $ref: '#/components/parameters/Page'
         *       - $ref: '#/components/parameters/Limit'
         *       - $ref: '#/components/parameters/Order'
         *     responses:
         *       200:
         *         description: A page of invoices
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/InvoiceListResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         */
        this.router.get(
            "/",
            authorize("read"),
            paginationValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const invoices = await this.invoiceController.handleGetInvoices(req);
                res.status(StatusCodes.OK).json(invoices);
            }
        );

        /**
         * @swagger
         * /invoices/{id}:
         *   get:
         *     summary: Get an invoice by ID
         *     tags: [Invoices]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     responses:
         *       200:
         *         description: The invoice
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/InvoiceResponse'
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
                const invoice = await this.invoiceController.handleGetInvoice(req);
                res.status(StatusCodes.OK).json(invoice);
            }
        );

        /**
         * @swagger
         * /invoices/{id}:
         *   patch:
         *     summary: Update an invoice
         *     description: Only the fields sent are changed. Sending companyId moves the invoice to that company and copies its name and registration number.
         *     tags: [Invoices]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/UpdateInvoiceInput'
         *     responses:
         *       200:
         *         description: The updated invoice
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/InvoiceResponse'
         *       400:
         *         $ref: '#/components/responses/BadRequest'
         *       404:
         *         $ref: '#/components/responses/NotFound'
         */
        this.router.patch(
            "/:id",
            authorize("write"),
            idParamValidator,
            updateInvoiceValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const updatedInvoice = await this.invoiceController.handleUpdateInvoice(req);
                res.status(StatusCodes.OK).json(updatedInvoice);
            }
        );

        /**
         * @swagger
         * /invoices/{id}:
         *   delete:
         *     summary: Delete an invoice
         *     description: Only invoices with status paid, cancelled or draft can be deleted.
         *     tags: [Invoices]
         *     parameters:
         *       - $ref: '#/components/parameters/Id'
         *     responses:
         *       204:
         *         description: Invoice deleted
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
                await this.invoiceController.handleDeleteInvoice(req);
                res.status(StatusCodes.NO_CONTENT).end();
            }
        );

    }
}
