import axiosInstance from "../axios";

export interface CastMember {
    _id: string;
    name: string;
    title?: string;
    photo?: any; // string or object (e.g. uploaded file payload)
    socialLinks?: { platform: string; url: string; _id?: string }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface CastListResponse {
    cast: CastMember[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface CastCreateInput {
    name: string;
    title?: string;
    photo?: string;
    socialLinks?: { platform: string; url: string }[];
}

export type CastUpdateInput = Partial<CastCreateInput>;

export interface CastQueryParams {
    page?: number;
    limit?: number;
    search?: string;
}



const extractCast = (payload: any): CastMember[] => {
    if (Array.isArray(payload?.cast)) return payload.cast as CastMember[];
    if (Array.isArray(payload?.data?.cast)) return payload.data.cast as CastMember[];
    if (Array.isArray(payload?.results)) return payload.results as CastMember[];
    if (Array.isArray(payload?.data)) return payload.data as CastMember[];
    if (Array.isArray(payload)) return payload as CastMember[];
    return [];
};

const buildMeta = (payload: any, count: number): CastListResponse["meta"] => {
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

export const getCast = async (params?: CastQueryParams): Promise<CastListResponse> => {
    const response = await axiosInstance.get("/cast", {
        params: { PageCount: "all", ...params },
    });
    const raw = response.data;
    const cast = extractCast(raw);
    const meta = buildMeta(raw, cast.length);
    return { cast, meta };
};

export const createCast = async (data: CastCreateInput): Promise<CastMember> => {
    const response = await axiosInstance.post("/cast", data);
    const raw = response.data?.cast || response.data?.data || response.data;
    return raw as CastMember;
};

export const updateCast = async (id: string, data: CastUpdateInput): Promise<CastMember> => {
    const response = await axiosInstance.put(`/cast/${id}`, data);
    const raw = response.data?.cast || response.data?.data || response.data;
    return raw as CastMember;
};

export const deleteCast = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/cast/${id}`);
};