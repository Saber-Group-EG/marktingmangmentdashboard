import axiosInstance from "../axios";

export interface ContractTerm {
    _id: string;
    key: string;
    keyAr: string;
    value?: string;
    valueAr?: string;
    category?: string | { _id?: string; id?: string; name?: string };
    deleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateContractTermDTO {
    key: string;
    keyAr: string;
    value?: string;
    valueAr?: string;
    category?: string;
}

export interface UpdateContractTermDTO {
    key?: string;
    keyAr?: string;
    value?: string;
    valueAr?: string;
    category?: string;
}

export interface ContractTermsResponse {
    data: ContractTerm[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface GetContractTermsParams {
    page?: number;
    limit?: number;
    search?: string;
}

export const contractTermsService = {
    getAll: async (params?: GetContractTermsParams): Promise<ContractTermsResponse> => {
        void params;
        const response = await axiosInstance.get("/contract-terms?PageCount=all");
        const raw = response.data;

        const data: ContractTerm[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.terms)
              ? raw.terms
              : Array.isArray(raw?.data)
                ? raw.data
                : Array.isArray(raw?.data?.terms)
                  ? raw.data.terms
                  : [];

        const parsedPage = typeof raw?.page === "string" ? Number(String(raw.page).split(" ")[0]) : Number(raw?.page);
        const total = Number(raw?.meta?.total ?? raw?.totalCount ?? data.length);
        const limit = Number(raw?.meta?.limit ?? raw?.limit ?? (data.length || 1));
        const totalPages = Number(raw?.meta?.totalPages ?? raw?.pageCount ?? Math.max(1, Math.ceil(total / Math.max(limit, 1))));

        return {
            data,
            meta: {
                total,
                page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
                limit,
                totalPages,
            },
        };
    },

    create: async (data: CreateContractTermDTO): Promise<ContractTerm> => {
        // Backend bulk endpoint expects an array payload (not wrapped in an object)
        const response = await axiosInstance.post("/contract-terms/bulk", [data]);
        return response.data;
    },

    update: async (id: string, data: UpdateContractTermDTO): Promise<ContractTerm> => {
        const response = await axiosInstance.put(`/contract-terms/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await axiosInstance.delete(`/contract-terms/${id}`);
    },
};
