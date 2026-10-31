import { inject } from "inversify";
import express, { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import { InvoiceController } from "../controllers/invoice.controller";
import { createInvoiceValidator } from "../validators/createInvoice.validator";
import { updateInvoiceValidator } from "../validators/updateInvoice.validator";
import { idParamValidator, paginationValidator } from "../validators/common.validator";
import { validateRequest } from "../middlewares/validateRequest";


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
         * /invoice/create:
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
         *         description: Invoice created successfully
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/Invoice'
         *       400:
         *         description: Validation error
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/Error'
         *       404:
         *         description: Company not found
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/Error'
         */
        this.router.post(
            "/create",
            createInvoiceValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const newInvoice = await this.invoiceController.handlePostInvoice(req);
                res.status(StatusCodes.CREATED).json(newInvoice);
            }
        );

        this.router.put(
            "/update/:id",
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
         * /invoice:
         *   get:
         *     summary: Get all invoices
         *     tags: [Invoices]
         *     parameters:
         *       - in: query
         *         name: page
         *         schema:
         *           type: integer
         *           minimum: 1
         *         description: Page number
         *       - in: query
         *         name: limit
         *         schema:
         *           type: integer
         *           minimum: 1
         *           maximum: 100
         *         description: Items per page
         *       - in: query
         *         name: order
         *         schema:
         *           type: string
         *           enum: [asc, desc]
         *         description: Sort order by creation date
         *     responses:
         *       200:
         *         description: List of invoices
         *         content:
         *           application/json:
         *             schema:
         *               type: array
         *               items:
         *                 $ref: '#/components/schemas/Invoice'
         *       400:
         *         description: Invalid query parameters
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/Error'
         */
        this.router.get(
            "/",
            paginationValidator,
            validateRequest,
            async (req: Request, res: Response) => {
                const allInvoices = await this.invoiceController.handleGetInvoices(req);
                res.json(allInvoices);
            }
        );

        /**
         * @swagger
         * /invoice/{id}:
         *   get:
         *     summary: Get invoice by ID
         *     tags: [Invoices]
         *     parameters:
         *       - in: path
         *         name: id
         *         required: true
         *         schema:
         *           type: string
         *         description: Invoice ID
         *     responses:
         *       200:
         *         description: Invoice found
         *         content:
         *           application/json:
         *             schema:
         *               $ref: '#/components/schemas/Invoice'
         *       400:
         *         description: Invalid invoice ID
         *       404:
         *         description: Invoice not found
         */
        this.router.get(
            "/:id",
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const invoice = await this.invoiceController.handleGetInvoice(req);
                res.status(StatusCodes.OK).json(invoice);
            }
        );

        this.router.delete(
            "/delete/:id",
            idParamValidator,
            validateRequest,
            async (req: Request<{ id: string }>, res: Response) => {
                const deletedInvoice = await this.invoiceController.handleDeleteInvoice(req);
                res.status(StatusCodes.OK).json({
                    message: "Invoice deleted successfully",
                    invoice: deletedInvoice
                });
            }
        );

    }
}
