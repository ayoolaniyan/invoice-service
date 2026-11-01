import { describe, expect, it } from "@jest/globals";
import { INVOICE_STATUSES, InvoiceStatus } from "../../src/models/invoice.interface";
import {
    canTransition,
    DELETABLE_INVOICE_STATUSES,
    INITIAL_INVOICE_STATUSES,
    INVOICE_STATUS_TRANSITIONS,
    isFinalStatus,
} from "../../src/models/invoiceStatus";

describe("invoice status lifecycle", () => {
    it("defines transitions for every status", () => {
        expect(Object.keys(INVOICE_STATUS_TRANSITIONS).sort()).toEqual([...INVOICE_STATUSES].sort());
    });

    it("only transitions to known statuses, never to itself", () => {
        for (const [from, targets] of Object.entries(INVOICE_STATUS_TRANSITIONS)) {
            for (const to of targets) {
                expect(INVOICE_STATUSES).toContain(to);
                expect(to).not.toBe(from);
            }
        }
    });

    it("can reach every status from a status a new invoice may start in", () => {
        const reachable = new Set<InvoiceStatus>(INITIAL_INVOICE_STATUSES);
        const queue = [...INITIAL_INVOICE_STATUSES];
        while (queue.length > 0) {
            for (const next of INVOICE_STATUS_TRANSITIONS[queue.shift()!]) {
                if (!reachable.has(next)) {
                    reachable.add(next);
                    queue.push(next);
                }
            }
        }

        expect([...reachable].sort()).toEqual([...INVOICE_STATUSES].sort());
    });

    it.each([
        ["draft", "pending", true],
        ["pending", "paid", true],
        ["overdue", "paid", true],
        ["draft", "paid", false],
        ["pending", "draft", false],
        ["paid", "pending", false],
        ["cancelled", "draft", false],
    ] as const)("canTransition(%s, %s) is %p", (from, to, expected) => {
        expect(canTransition(from, to)).toBe(expected);
    });

    it("treats only paid and cancelled as final", () => {
        expect(INVOICE_STATUSES.filter(isFinalStatus).sort()).toEqual(["cancelled", "paid"]);
    });

    it("only allows deleting drafts", () => {
        expect(DELETABLE_INVOICE_STATUSES).toEqual(["draft"]);
    });
});
