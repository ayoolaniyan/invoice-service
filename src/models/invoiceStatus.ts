import { InvoiceStatus } from "./invoice.interface";

/**
 * The invoice lifecycle:
 *
 *   draft ──> pending ──> paid
 *     │          │  └──> overdue ──> paid
 *     │          │          │
 *     └──────────┴──────────┴──> cancelled
 *
 * paid and cancelled are final. Issued invoices are cancelled rather than deleted,
 * so the invoice number sequence keeps a record of every invoice that was sent.
 */
export const INVOICE_STATUS_TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
    draft: ["pending", "cancelled"],
    pending: ["paid", "overdue", "cancelled"],
    overdue: ["paid", "cancelled"],
    paid: [],
    cancelled: [],
};

/** Statuses a new invoice can start in; the others are only reached through a transition */
export const INITIAL_INVOICE_STATUSES: readonly InvoiceStatus[] = ["draft", "pending"];

/** Only drafts can be deleted; an issued invoice must be cancelled instead */
export const DELETABLE_INVOICE_STATUSES: readonly InvoiceStatus[] = ["draft"];

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
    return INVOICE_STATUS_TRANSITIONS[from].includes(to);
}

/** Final invoices can't be changed at all */
export function isFinalStatus(status: InvoiceStatus): boolean {
    return INVOICE_STATUS_TRANSITIONS[status].length === 0;
}
