import axiosInstance from "../axios";

export interface Subcategory {
    _id: string;
    name: string | { en: string; ar: string };
    parentCategory: string;
    createdAt?: string;
    updatedAt?: string;
}

export const getSubcategoryDisplayName = (
    subcategory: { name?: string | { en?: string; ar?: string } } | null | undefined,
    lang: string = "en",
): string => {
    if (!subcategory) return "";
    const name = subcategory.name;
    if (typeof name === "string") return name;
    if (name && typeof name === "object") return name[lang as keyof typeof name] || name.en || name.ar || "";
    return "";
};

export interface SubcategoryListResponse {
    subcategories: Subcategory[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface SubcategoryQueryParams {
    parentCategory?: string;
    page?: number;
    search?: string;
}

const extractSubcategories = (payload: any): Subcategory[] => {
    if (Array.isArray(payload?.subcategories)) return payload.subcategories as Subcategory[];
    if (Array.isArray(payload?.data?.subcategories)) return payload.data.subcategories as Subcategory[];
    if (Array.isArray(payload?.data)) return payload.data as Subcategory[];
    if (Array.isArray(payload)) return payload as Subcategory[];
    return [];
};

const buildMeta = (payload: any, count: number): SubcategoryListResponse["meta"] => {
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

export const getSubcategories = async (params?: SubcategoryQueryParams): Promise<SubcategoryListResponse> => {
    const response = await axiosInstance.get("/subcategories", {
        params: {
            ...params,
            PageCount: "all",
        },
    });
    const raw = response.data;
    const subcategories = extractSubcategories(raw);
    const meta = buildMeta(raw, subcategories.length);
    return { subcategories, meta };
};

export const createSubcategory = async (data: { name: { en: string; ar: string }; parentCategory: string }): Promise<Subcategory> => {
    const response = await axiosInstance.post("/subcategories", data);
    const raw = response.data?.subcategory || response.data?.data || response.data;
    return raw as Subcategory;
};

export const updateSubcategory = async (
    id: string,
    data: { name: { en: string; ar: string }; parentCategory: string },
): Promise<Subcategory> => {
    const response = await axiosInstance.put(`/subcategories/${id}`, data);
    const raw = response.data?.subcategory || response.data?.data || response.data;
    return raw as Subcategory;
};

export const deleteSubcategory = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/subcategories/${id}`);
};
