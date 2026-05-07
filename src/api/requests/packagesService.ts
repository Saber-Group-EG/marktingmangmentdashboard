import api from "../axios";
import { Item } from "./itemsService";
import { withCache, invalidateCachePattern } from "../../utils/apiCache";

/**
 * Packages API Service
 * Handles CRUD operations for packages
 */

export interface PackageItem {
    _id?: string;
    item?: string | Item;
    quantity?: number | string | boolean;
    note?: string;
}

export interface Package {
    _id: string;
    id?: string;
    nameEn: string;
    nameAr: string;
    price: number;
    description?: string;
    descriptionAr?: string;
    category?: string | { _id?: string; id?: string; name?: string };
    items?: PackageItem[];
    deleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface PackageListResponse {
    data: Package[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface PackageQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
}

/**
 * Get all packages with pagination and filters
 */
export const getPackages = async (params?: PackageQueryParams): Promise<PackageListResponse> => {
    return withCache(
        "/packages",
        async () => {
            try {
                void params;
                // Backend currently rejects query params on this endpoint, so fetch plain list.
                const response = await api.get("/packages?PageCount=all");
                const raw = response.data;

                const data: Package[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.packages)
                      ? raw.packages
                      : Array.isArray(raw?.data)
                        ? raw.data
                        : [];

                const total = Number(raw?.meta?.total ?? raw?.totalCount ?? data.length);
                const page = Number(raw?.meta?.page ?? raw?.page ?? 1);
                const limit = Number(raw?.meta?.limit ?? raw?.limit ?? (data.length || 1));
                const totalPages = Number(raw?.meta?.totalPages ?? raw?.pageCount ?? Math.max(1, Math.ceil(total / Math.max(limit, 1))));

                return {
                    data,
                    meta: {
                        total,
                        page,
                        limit,
                        totalPages,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1,
                    },
                };
            } catch (error) {
                throw error;
            }
        },
        params,
    );
};

/**
 * Get a single package by ID
 */
export const getPackageById = async (id: string): Promise<Package> => {
    return withCache(`/packages/${id}`, async () => {
        try {
            const response = await api.get(`/packages/${id}?PageCount=all`);
            return response.data.data;
        } catch (error) {
            throw error;
        }
    });
};

/**
 * Create a new package
 */
export const createPackage = async (packageData: {
    nameEn: string;
    nameAr: string;
    price: number;
    description?: string;
    descriptionAr?: string;
    category?: string;
    items?: { item: string; quantity?: number | string | boolean; note?: string }[];
}): Promise<Package> => {
    try {
        const response = await api.post("/packages", packageData);
        // Invalidate packages cache after creating
        invalidateCachePattern("/packages");
        return response.data.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Update a package
 */
export const updatePackage = async (
    id: string,
    packageData: {
        nameEn?: string;
        nameAr?: string;
        price?: number;
        description?: string;
        descriptionAr?: string;
        category?: string;
        items?: { item: string; quantity?: number | string | boolean; note?: string }[];
    },
): Promise<Package> => {
    try {
        const response = await api.put(`/packages/${id}`, packageData);
        // Invalidate packages cache after updating
        invalidateCachePattern("/packages");
        return response.data.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Delete a package (soft delete)
 */
export const deletePackage = async (id: string): Promise<void> => {
    try {
        await api.delete(`/packages/${id}`);
        // Invalidate packages cache after deleting
        invalidateCachePattern("/packages");
    } catch (error) {
        throw error;
    }
};

// Cache clearing utility
export const clearPackagesCache = () => {
    invalidateCachePattern("/packages");
};
