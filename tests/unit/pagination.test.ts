import { describe, expect, it } from "@jest/globals";
import { buildPaginationMeta, DEFAULT_PAGINATION, resolvePagination } from "../../src/models/pagination.interface";

describe("resolvePagination", () => {
    it("uses defaults for missing values", () => {
        expect(resolvePagination({})).toEqual(DEFAULT_PAGINATION);
    });

    it("keeps values that were given", () => {
        expect(resolvePagination({ page: 3, limit: 25, order: "desc" })).toEqual({ page: 3, limit: 25, order: "desc" });
    });
});

describe("buildPaginationMeta", () => {
    it.each([
        [0, 10, 0],
        [1, 10, 1],
        [10, 10, 1],
        [23, 10, 3],
    ])("%p items with limit %p gives %p pages", (total, limit, totalPages) => {
        expect(buildPaginationMeta({ page: 1, limit, order: "asc" }, total)).toEqual({ total, page: 1, limit, totalPages });
    });
});
