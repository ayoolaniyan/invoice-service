import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { INVOICE_STATUSES } from '../models/invoice.interface';
import { INITIAL_INVOICE_STATUSES } from '../models/invoiceStatus';
import { API_PREFIX } from './routes.config';
import { API_KEY_HEADER } from '../middlewares/auth';

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
        description: 'Invoice status. Allowed changes: draft → pending or cancelled; pending → paid, overdue or cancelled; overdue → paid or cancelled. paid and cancelled are final.',
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

// The registration number can't be changed after a company is created
const { registrationNumber: _registrationNumber, ...updatableCompanyProperties } = companyInputProperties;

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
        security: [{ ApiKeyAuth: [] }],
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
                Conflict: errorResponse('Conflicts with the current state: a duplicate unique value, a status change that is not allowed, or a change made by another request'),
                Unauthorized: errorResponse(`Missing or invalid ${API_KEY_HEADER} header`),
                Forbidden: errorResponse('The API key does not have the "write" role'),
                TooManyRequests: errorResponse('Rate limit exceeded; retry after the time in the Retry-After header'),
            },
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: API_KEY_HEADER,
                    description: 'Keys have a role: "read" keys can only use GET endpoints, "write" keys can use all endpoints.',
                },
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
                    properties: {
                        ...invoiceInputProperties,
                        status: {
                            type: 'string',
                            enum: INITIAL_INVOICE_STATUSES,
                            description: 'A new invoice starts as draft or pending',
                        },
                    },
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
                    properties: updatableCompanyProperties,
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
    // Relative to this file, so it works from any working directory and from the compiled build (dist/)
    apis: [path.join(__dirname, '../routes/*.{ts,js}').replace(/\\/g, '/')], // glob needs forward slashes, also on Windows
};

type OperationResponses = Record<string, Record<string, unknown>>;

// Every operation needs an API key and is rate limited, and writes need the "write" role,
// so add those responses here instead of repeating them in each route's docs
function addSecurityResponses(spec: object): object {
    const paths = (spec as { paths?: Record<string, Record<string, { responses?: OperationResponses }>> }).paths ?? {};

    for (const operations of Object.values(paths)) {
        for (const [method, operation] of Object.entries(operations)) {
            operation.responses ??= {};
            operation.responses['401'] ??= { $ref: '#/components/responses/Unauthorized' };
            if (method !== 'get') {
                operation.responses['403'] ??= { $ref: '#/components/responses/Forbidden' };
            }
            operation.responses['429'] ??= { $ref: '#/components/responses/TooManyRequests' };
        }
    }

    return spec;
}

export const swaggerSpec = addSecurityResponses(swaggerJsdoc(options));
