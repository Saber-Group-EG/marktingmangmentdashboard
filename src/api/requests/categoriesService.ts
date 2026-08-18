import axiosInstance from "../axios";

export type CategoryType = "item" | "package" | "term" | "project";

export interface Category {
    _id: string;
    name: string | { en: string; ar: string };
    type: CategoryType;
    createdAt?: string;
    updatedAt?: string;
}

export const getCategoryDisplayName = (
    category: { name?: string | { en?: string; ar?: string } } | null | undefined,
    lang: string = "en",
): string => {
    if (!category) return "";
    const name = category.name;
    if (typeof name === "string") return name;
    if (name && typeof name === "object") return name[lang as keyof typeof name] || name.en || name.ar || "";
    return "";
};

export interface CategoryListResponse {
    categories: Category[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface CategoryQueryParams {
    type?: CategoryType;
    page?: number;
    search?: string;
}

const extractCategories = (payload: any): Category[] => {
    if (Array.isArray(payload?.categories)) return payload.categories as Category[];
    if (Array.isArray(payload?.data?.categories)) return payload.data.categories as Category[];
    if (Array.isArray(payload?.data)) return payload.data as Category[];
    if (Array.isArray(payload)) return payload as Category[];
    return [];
};

const buildMeta = (payload: any, count: number): CategoryListResponse["meta"] => {
    const total = Number(payload?.meta?.total ?? payload?.total ?? count);
    const page = Number(payload?.meta?.page ?? payload?.page ?? 1);
const limit = Number((payload?.meta?.limit ?? payload?.limit ?? count) || 20);
    const totalPages = Number(
        payload?.meta?.totalPages ??
        payload?.totalPages ??
        payload?.pageCount ??
        (limit ? Math.max(1, Math.ceil(total / Math.max(limit, 1))) : 1)
    );

    return {
        total: Number.isFinite(total) ? total : count,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : (count || 20),
        totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    };
};

export const getCategories = async (params?: CategoryQueryParams): Promise<CategoryListResponse> => {
    const response = await axiosInstance.get("/categories", { params });
    const raw = response.data;
    const categories = extractCategories(raw);
    const meta = buildMeta(raw, categories.length);
    return { categories, meta };
};

export const createCategory = async (data: { name: { en: string; ar: string }; type: CategoryType }): Promise<Category> => {
    const response = await axiosInstance.post("/categories", data);
    const raw = response.data?.category || response.data?.data || response.data;
    return raw as Category;
};

export const updateCategory = async (
    id: string,
    data: { name: { en: string; ar: string }; type: CategoryType },
): Promise<Category> => {
    const response = await axiosInstance.put(`/categories/${id}`, data);
    const raw = response.data?.category || response.data?.data || response.data;
    return raw as Category;
};

export const deleteCategory = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/categories/${id}`);
};