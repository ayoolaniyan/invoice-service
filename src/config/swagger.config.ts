import swaggerJsdoc from 'swagger-jsdoc';
import { INVOICE_STATUSES } from '../models/invoice.interface';
import { API_PREFIX } from './routes.config';

const invoiceInputProperties = {
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
        enum: INVOICE_STATUSES,
        description: 'Invoice status',
    },
    amount: {
        type: 'integer',
        minimum: 0,
        example: 15050,
        description: "Invoice amount as a whole number in the currency's minor unit, e.g. 15050 is NGN 150.50",
    },
    currency: {
        type: 'string',
        pattern: '^[A-Z]{3}$',
        example: 'NGN',
        description: 'ISO 4217 currency code. When updating, amount must be sent with it.',
    },
    companyId: {
        type: 'string',
        description: 'ID of an existing company. Company name and registration number are copied from it.',
    },
};

const companyInputProperties = {
    name: {
        type: 'string',
        maxLength: 100,
        description: 'Company name',
    },
    registrationNumber: {
        type: 'string',
        description: 'Company registration number',
    },
    email: {
        type: 'string',
        format: 'email',
        description: 'Company email',
    },
    phone: {
        type: 'string',
        description: 'Company phone number',
    },
    address: {
        type: 'string',
        description: 'Company address',
    },
};

const timestampProperties = {
    createdAt: {
        type: 'string',
        format: 'date-time',
    },
    updatedAt: {
        type: 'string',
        format: 'date-time',
    },
};

// Every response is wrapped by the responseFormatter middleware
function successEnvelope(data: object, withMeta = false) {
    return {
        type: 'object',
        properties: {
            status: { type: 'string', enum: ['success'] },
            statusCode: { type: 'integer' },
            message: { type: 'string' },
            data,
            ...(withMeta ? { meta: { $ref: '#/components/schemas/PaginationMeta' } } : {}),
        },
    };
}

function errorResponse(description: string) {
    return {
        description,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
        },
    };
}

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
                url: API_PREFIX,
                description: 'Current server',
            },
        ],
        tags: [
            { name: 'Invoices' },
            { name: 'Companies' },
        ],
        components: {
            parameters: {
                Id: {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: { type: 'string' },
                    description: 'MongoDB ObjectId of the resource',
                },
                Page: {
                    in: 'query',
                    name: 'page',
                    schema: { type: 'integer', minimum: 1, default: 1 },
                    description: 'Page number',
                },
                Limit: {
                    in: 'query',
                    name: 'limit',
                    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
                    description: 'Items per page',
                },
                Order: {
                    in: 'query',
                    name: 'order',
                    schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
                    description: 'Sort order by creation date',
                },
            },
            responses: {
                BadRequest: errorResponse('Validation error or invalid ID'),
                NotFound: errorResponse('Resource not found'),
                Conflict: errorResponse('Request conflicts with the current state of the resource'),
            },
            schemas: {
                Invoice: {
                    type: 'object',
                    required: ['_id', 'invoiceNumber', 'issueDate', 'dueDate', 'status', 'amount', 'currency', 'companyId', 'companyName', 'companyRegistrationNumber'],
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'Auto-generated MongoDB ID',
                        },
                        ...invoiceInputProperties,
                        companyName: {
                            type: 'string',
                            description: 'Company name, copied from the company',
                        },
                        companyRegistrationNumber: {
                            type: 'string',
                            description: 'Company registration number, copied from the company',
                        },
                        ...timestampProperties,
                    },
                },
                CreateInvoiceInput: {
                    type: 'object',
                    required: ['invoiceNumber', 'issueDate', 'dueDate', 'status', 'amount', 'currency', 'companyId'],
                    properties: invoiceInputProperties,
                },
                UpdateInvoiceInput: {
                    type: 'object',
                    minProperties: 1,
                    properties: invoiceInputProperties,
                },
                Company: {
                    type: 'object',
                    required: ['_id', 'name', 'registrationNumber', 'email', 'phone', 'address'],
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'Auto-generated MongoDB ID',
                        },
                        ...companyInputProperties,
                        ...timestampProperties,
                    },
                },
                CreateCompanyInput: {
                    type: 'object',
                    required: ['name', 'registrationNumber', 'email', 'phone', 'address'],
                    properties: companyInputProperties,
                },
                UpdateCompanyInput: {
                    type: 'object',
                    minProperties: 1,
                    properties: (({ registrationNumber, ...rest }) => rest)(companyInputProperties),
                },
                PaginationMeta: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer', description: 'Total number of items' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
                InvoiceResponse: successEnvelope({ $ref: '#/components/schemas/Invoice' }),
                InvoiceListResponse: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/Invoice' } }, true),
                CompanyResponse: successEnvelope({ $ref: '#/components/schemas/Company' }),
                CompanyListResponse: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/Company' } }, true),
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['error'] },
                        statusCode: { type: 'integer' },
                        message: { type: 'string' },
                        error: {
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
        },
    },
    apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
