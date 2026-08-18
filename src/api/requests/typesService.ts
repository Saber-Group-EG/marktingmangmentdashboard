import axiosInstance from "../axios";

export interface ProjectType {
    _id?: string;
    id?: string;
    name: string | { en: string; ar: string };
    createdAt?: string;
    updatedAt?: string;
}

export const createType = async (data: { name: { en: string; ar: string } }): Promise<ProjectType> => {
    const response = await axiosInstance.post("/types", data);
    const raw = response.data?.data || response.data?.type || response.data;
    return raw as ProjectType;
};
