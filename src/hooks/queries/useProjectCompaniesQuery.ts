import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getProjectCompanies,
    createProjectCompany,
    updateProjectCompany,
    deleteProjectCompany,
    type ProjectCompanyInput,
} from "@/api/requests/projectCompaniesService";

export const projectCompaniesKeys = {
    all: ["project-companies"] as const,
    lists: () => [...projectCompaniesKeys.all, "list"] as const,
    list: () => [...projectCompaniesKeys.lists()] as const,
};

export const getProjectCompaniesQueryKey = () => projectCompaniesKeys.list();

export const useProjectCompaniesCacheActions = () => {
    const queryClient = useQueryClient();

    const removeProjectCompaniesCache = () => {
        queryClient.removeQueries({ queryKey: projectCompaniesKeys.list(), exact: true });
    };

    const removeAllProjectCompaniesCache = () => {
        queryClient.removeQueries({ queryKey: projectCompaniesKeys.lists() });
    };

    const invalidateProjectCompaniesCache = () => {
        queryClient.invalidateQueries({ queryKey: projectCompaniesKeys.list(), exact: true });
    };

    return { removeProjectCompaniesCache, removeAllProjectCompaniesCache, invalidateProjectCompaniesCache };
};

export const useProjectCompanies = () => {
    return useQuery({
        queryKey: projectCompaniesKeys.list(),
        queryFn: getProjectCompanies,
    });
};

export const useCreateProjectCompany = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createProjectCompany,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectCompaniesKeys.lists() });
        },
    });
};

export const useUpdateProjectCompany = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ProjectCompanyInput> }) =>
            updateProjectCompany(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectCompaniesKeys.lists() });
        },
    });
};

export const useDeleteProjectCompany = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteProjectCompany,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectCompaniesKeys.lists() });
        },
    });
};