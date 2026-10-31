export interface IPagination {
    limit: number;
    page: number;
    order: "asc" | "desc";
}

export interface IPaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface IPaginatedResult<T> {
    data: T[];
    meta: IPaginationMeta;
}

export const DEFAULT_PAGINATION: IPagination = {
    limit: 10,
    page: 1,
    order: "asc",
};

export function resolvePagination(pagination: Partial<IPagination>): IPagination {
    return {
        limit: pagination.limit ?? DEFAULT_PAGINATION.limit,
        page: pagination.page ?? DEFAULT_PAGINATION.page,
        order: pagination.order ?? DEFAULT_PAGINATION.order,
    };
}

export function buildPaginationMeta(pagination: IPagination, total: number): IPaginationMeta {
    return {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
    };
}
