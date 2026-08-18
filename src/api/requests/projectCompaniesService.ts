import axiosInstance from "../axios";

export interface ProjectCompany {
    _id: string;
    name: { en: string; ar: string } | string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProjectCompanyInput {
    name: { en: string; ar: string };
}

const extractProjectCompanies = (payload: any): ProjectCompany[] => {
    if (Array.isArray(payload?.companies)) return payload.companies as ProjectCompany[];
    if (Array.isArray(payload?.data?.companies)) return payload.data.companies as ProjectCompany[];
    if (Array.isArray(payload?.projectCompanies)) return payload.projectCompanies as ProjectCompany[];
    if (Array.isArray(payload?.results)) return payload.results as ProjectCompany[];
    if (Array.isArray(payload?.data)) return payload.data as ProjectCompany[];
    if (Array.isArray(payload)) return payload as ProjectCompany[];
    return [];
};

export const getProjectCompanies = async (): Promise<ProjectCompany[]> => {
    const response = await axiosInstance.get("/project-companies");
    return extractProjectCompanies(response.data);
};

export const createProjectCompany = async (data: ProjectCompanyInput): Promise<ProjectCompany> => {
    const response = await axiosInstance.post("/project-companies", data);
    const raw = response.data?.company || response.data?.data || response.data;
    return raw as ProjectCompany;
};

export const updateProjectCompany = async (
    id: string,
    data: Partial<ProjectCompanyInput>,
): Promise<ProjectCompany> => {
    const response = await axiosInstance.put(`/project-companies/${id}`, data);
    const raw = response.data?.company || response.data?.data || response.data;
    return raw as ProjectCompany;
};

export const deleteProjectCompany = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/project-companies/${id}`);
};