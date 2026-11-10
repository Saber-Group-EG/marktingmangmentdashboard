import axiosInstance from "../axios";

export interface ProjectType {
    _id?: string;
    id?: string;
    name: string | { en: string; ar: string };
    createdAt?: string;
    updatedAt?: string;
}

const asTypeList = (value: unknown): ProjectType[] | null =>
    Array.isArray(value) ? (value as ProjectType[]) : null;

const extractTypes = (payload: unknown): ProjectType[] => {
    const direct = asTypeList(payload);
    if (direct) return direct;
    if (!payload || typeof payload !== "object") return [];

    const record = payload as Record<string, unknown>;
    const data = record.data;
    const dataRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    return (
        asTypeList(record.types) ??
        (dataRecord ? asTypeList(dataRecord.types) : null) ??
        asTypeList(record.results) ??
        asTypeList(data) ??
        []
    );
};

const extractType = (payload: unknown): ProjectType => {
    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        if (record.type && typeof record.type === "object") return record.type as ProjectType;
        if (record.data && typeof record.data === "object") return record.data as ProjectType;
    }
    return payload as ProjectType;
};

export const getTypes = async (): Promise<ProjectType[]> => {
    const response = await axiosInstance.get("/types", {
        params: { PageCount: "all" },
    });
    return extractTypes(response.data);
};

export const createType = async (data: { name: { en: string; ar: string } }): Promise<ProjectType> => {
    const response = await axiosInstance.post("/types", data);
    return extractType(response.data);
};

export const updateType = async (
    id: string,
    data: { name: { en: string; ar: string } },
): Promise<ProjectType> => {
    const response = await axiosInstance.put(`/types/${id}`, data);
    return extractType(response.data);
};

export const deleteType = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/types/${id}`);
};
