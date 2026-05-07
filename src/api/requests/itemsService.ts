import api from "../axios";
import { withCache, invalidateCachePattern } from "../../utils/apiCache";

/**
 * Items API Service
 * Handles CRUD operations for items
 */

export interface Item {
    _id: string;
    name: string;
    ar: string;
    description?: string;
    descriptionAr?: string;
    category?: string | { _id?: string; id?: string; name?: string };
    deleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ItemListResponse {
    data: Item[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface ItemQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

/**
 * Get all items with pagination and filters
 */
export const getItems = async (params?: ItemQueryParams): Promise<ItemListResponse> => {
    return withCache(
        "/items",
        async () => {
            try {
                // Backend currently rejects query params for this endpoint, so fetch plain list.
                const response = await api.get("/items?PageCount=all");
                const raw = response.data;

                const data: Item[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.items)
                      ? raw.items
                      : Array.isArray(raw?.data)
                        ? raw.data
                        : [];

                const meta = raw?.meta || {
                    total: Number(raw?.totalCount) || data.length,
                    page: Number(raw?.page) || 1,
                    limit: Number(raw?.limit) || data.length || 1,
                    totalPages: Number(raw?.pageCount) || 1,
                };

                return { data, meta };
            } catch (error) {
                throw error;
            }
        },
        params,
    );
};

/**
 * Get a single item by ID
 */
export const getItemById = async (id: string): Promise<Item> => {
    return withCache(`/items/${id}`, async () => {
        try {
            const response = await api.get(`/items/${id}?PageCount=all`);
            return response.data.data;
        } catch (error) {
            throw error;
        }
    });
};

/**
 * Create a new item
 */
export const createItem = async (itemData: {
    name: string;
    ar?: string;
    description?: string;
    descriptionAr?: string;
    category?: string;
}): Promise<Item> => {
    try {
        const response = await api.post("/items", itemData);
        // Invalidate items cache after creating
        invalidateCachePattern("/items");
        return response.data.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Update an item
 */
export const updateItem = async (
    id: string,
    itemData: {
        name?: string;
        ar?: string;
        description?: string;
        descriptionAr?: string;
        category?: string;
    },
): Promise<Item> => {
    try {
        const response = await api.put(`/items/${id}`, itemData);
        // Invalidate items cache after updating
        invalidateCachePattern("/items");
        return response.data.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Delete an item (soft delete)
 */
export const deleteItem = async (id: string): Promise<void> => {
    try {
        await api.delete(`/items/${id}`);
        // Invalidate items cache after deleting
        invalidateCachePattern("/items");
    } catch (error) {
        throw error;
    }
};

// Cache clearing utility
export const clearItemsCache = () => {
    invalidateCachePattern("/items");
};
