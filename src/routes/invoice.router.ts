import { inject } from "inversify";
import express, { Request, Response, Router } from "express";
import { validationResult } from "express-validator";
import { StatusCodes } from "http-status-codes";
import { InvoiceController } from "../controllers/invoice.controller";
import { createInvoiceValidator } from "../validators/createInvoice.validator";
import { IInvoice } from "../models/invoice.interface";
import { updateInvoiceValidator } from "../validators/updateInvoice.validator";


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
         *             $ref: '#/components/schemas/Invoice'                                                                                                                                    
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
         */
        this.router.post(
            "/create",
            createInvoiceValidator,
            async (req: Request<{}, {}, IInvoice>, res: Response) => {
                const result = validationResult(req);
                if (result.isEmpty()) {
                    const newInvoice = await this.invoiceController.handlePostInvoice(req, res);
                    res.status(StatusCodes.CREATED).json(newInvoice);
                } else {
                    res.status(StatusCodes.BAD_REQUEST).json(result.array());
                }
            }
        );

        this.router.put(
            "/update/:id",
            updateInvoiceValidator,
            async (req: Request<{ id: string }, {}, Partial<IInvoice>>, res: Response) => {
                const result = validationResult(req);
                if (result.isEmpty()) {
                    try {
                        const updatedInvoice = await this.invoiceController.updateInvoice(req.params.id, req.body);
                        res.status(StatusCodes.OK).json(updatedInvoice);
                    } catch (error: any) {
                        res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
                    }
                } else {
                    res.status(StatusCodes.BAD_REQUEST).json(result.array());
                }
            });

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
         *         description: Page number                                                                                                                                                    
         *       - in: query                                                                                                                                                                   
         *         name: limit                                                                                                                                                                 
         *         schema:                                                                                                                                                                     
         *           type: integer                                                                                                                                                             
         *         description: Items per page                                                                                                                                                 
         *     responses:                                                                                                                                                                      
         *       200:                                                                                                                                                                          
         *         description: List of invoices                                                                                                                                               
         *         content:                                                                                                                                                                    
         *           application/json:                                                                                                                                                         
         *             schema:                                                                                                                                                                 
         *               type: array                                                                                                                                                           
         *               items:                                                                                                                                                                
         *                 $ref: '#/components/schemas/Invoice'                                                                                                                                
         */
        this.router.get("/", async (req: Request, res: Response) => {
            const result = validationResult(req);
            if (result.isEmpty()) {
                const allInvoices = await this.invoiceController.handleGetInvoices(req, res);
                res.json(allInvoices);
            } else {
                res.status(StatusCodes.BAD_REQUEST).json(result.array());
            }

        });

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
         *       404:                                                                                                                                                                          
         *         description: Invoice not found                                                                                                                                              
         */
        this.router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
            const result = validationResult(req);
            if (result.isEmpty()) {
                try {
                    const invoice = await this.invoiceController.handleGetInvoice(req.params.id);
                    res.status(StatusCodes.OK).json(invoice);
                } catch (error: any) {
                    res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
                }
            } else {
                res.status(StatusCodes.BAD_REQUEST).json(result.array());
            }

        });

        this.router.delete("/delete/:id", async (req: Request<{ id: string }>, res: Response) => {
            try {
                const deletedInvoice = await this.invoiceController.handleDeleteInvoice(req.params.id);
                res.status(StatusCodes.OK).json({
                    message: "Invoice deleted succesfully",
                    company: deletedInvoice
                });
            } catch (error: any) {
                res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
            }
        });

    }
}
