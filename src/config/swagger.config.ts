import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Invoice Service API',
            version: '1.0.0',
            description: 'Invoice Management API Documentation',
            contact: {
                name: 'Olaniyan A. O',
            },
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server',
            },
        ],
        components: {
            schemas: {
                Invoice: {
                    type: 'object',
                    required: ['invoiceNumber', 'issueDate', 'dueDate', 'status', 'amount', 'companyId', 'companyName', 'companyRegistrationNumber'],
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'Auto-generated MongoDB ID',
                        },
                        invoiceNumber: {
                            type: 'string',
                            description: 'Unique invoice number',
                        },
                        description: {
                            type: 'string',
                            description: 'Invoice description',
                        },
                        issueDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Date when invoice was issued',
                        },
                        dueDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Payment due date',
                        },
                        status: {
                            type: 'string',
                            enum: ['paid', 'draft', 'overdue', 'cancelled', 'pending'],
                            description: 'Invoice status',
                        },
                        amount: {
                            type: 'number',
                            description: 'Invoice amount',
                        },
                        companyId: {
                            type: 'string',
                            description: 'Associated company ID',
                        },
                        companyName: {
                            type: 'string',
                            description: 'Company name',
                        },
                        companyRegistrationNumber: {
                            type: 'string',
                            description: 'Company registration number',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                CreateInvoiceInput: {
                    type: 'object',
                    required: ['invoiceNumber', 'issueDate', 'dueDate', 'status', 'amount', 'companyId'],
                    properties: {
                        invoiceNumber: {
                            type: 'string',
                            maxLength: 100,
                            description: 'Invoice number',
                        },
                        description: {
                            type: 'string',
                            description: 'Invoice description',
                        },
                        issueDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Date when invoice was issued',
                        },
                        dueDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Payment due date, can not be before issueDate',
                        },
                        status: {
                            type: 'string',
                            enum: ['paid', 'draft', 'overdue', 'cancelled', 'pending'],
                            description: 'Invoice status',
                        },
                        amount: {
                            type: 'number',
                            minimum: 0,
                            description: 'Invoice amount',
                        },
                        companyId: {
                            type: 'string',
                            description: 'ID of an existing company. Company name and registration number are copied from it.',
                        },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field: { type: 'string' },
                                    location: { type: 'string' },
                                    message: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'], // Path to the API routes                                                                                                                               
};

export const swaggerSpec = swaggerJsdoc(options); 
