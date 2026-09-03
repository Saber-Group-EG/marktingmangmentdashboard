import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@/api/interfaces/projectInterface";
import {
    getProjects,
    getProjectsPaginated,
    getProjectById,
    createProject,
    updateProject,
    togglePublishProject,
    deleteProject,
    reorderProjects,
    getProjectCategories,
    getProjectTypes,
    type ProjectTaxonomyOption,
    getProjectCast,
    type ProjectListResponse,
} from "@/api/requests/projectsService";

export const projectsKeys = {
    all: ["projects"] as const,
    lists: () => [...projectsKeys.all, "list"] as const,
    list: (params?: Record<string, any>) => [...projectsKeys.lists(), params] as const,
    details: () => [...projectsKeys.all, "detail"] as const,
    detail: (id: string) => [...projectsKeys.details(), id] as const,
    categories: () => [...projectsKeys.all, "categories"] as const,
    types: () => [...projectsKeys.all, "types"] as const,
    cast: () => [...projectsKeys.all, "cast"] as const,
};

export const useProjects = (params?: Record<string, any>, opts?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: projectsKeys.list(params),
        queryFn: () => getProjects(params),
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        enabled: opts?.enabled !== undefined ? opts.enabled : true,
    });
};

export const useProjectsPaginated = (params?: Record<string, any>, opts?: { enabled?: boolean }) => {
    return useQuery<ProjectListResponse>({
        queryKey: projectsKeys.list(params),
        queryFn: () => getProjectsPaginated(params),
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        enabled: opts?.enabled !== undefined ? opts.enabled : true,
    });
};

export const useProject = (id?: string, opts?: { enabled?: boolean }) => {
    const queryClient = useQueryClient();

    const shouldEnable = typeof opts?.enabled === "boolean" ? opts.enabled : !!id;

    const getInitialData = (): Project | undefined => {
        if (!id) return undefined;
        // Check detail cache first
        const cachedDetail = queryClient.getQueryData(projectsKeys.detail(id)) as Project | undefined;
        if (cachedDetail) return cachedDetail;
        // Fall back to list cache — find the project by id in any cached projects list
        const listQueries = queryClient.getQueriesData<Project[]>({ queryKey: projectsKeys.lists() });
        for (const [, data] of listQueries) {
            if (!Array.isArray(data)) continue;
            const found = data.find((p: any) => (p?.id || p?._id) === id);
            if (found) return found;
        }
        return undefined;
    };

    const initialData = getInitialData();

    return useQuery({
        queryKey: projectsKeys.detail(id || ""),
        queryFn: () => getProjectById(id || ""),
        enabled: shouldEnable,
        initialData,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });
};

export const useProjectCategories = () => {
    return useQuery<ProjectTaxonomyOption[]>({
        queryKey: projectsKeys.categories(),
        queryFn: getProjectCategories,
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useProjectTypes = () => {
    return useQuery<ProjectTaxonomyOption[]>({
        queryKey: projectsKeys.types(),
        queryFn: getProjectTypes,
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useProjectCast = () => {
    return useQuery<ProjectTaxonomyOption[]>({
        queryKey: projectsKeys.cast(),
        queryFn: getProjectCast,
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useCreateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Project>) => createProject(data as any),
        onSuccess: (createdProject) => {
            const createdId = (createdProject as any)?.id || (createdProject as any)?._id;

            if (createdId) {
                queryClient.setQueriesData<Project[]>({ queryKey: projectsKeys.lists() }, (current) => {
                    if (!Array.isArray(current)) return [createdProject as Project];
                    return [
                        createdProject as Project,
                        ...current.filter((p: any) => ((p?.id || p?._id) !== createdId)),
                    ];
                });
                // Avoid seeding detail cache with create response because taxonomy fields can be raw IDs.
                // Let the preview page fetch full project details so category/type names render immediately.
                queryClient.removeQueries({ queryKey: projectsKeys.detail(createdId), exact: true });
            }

            queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
        },
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
            updateProject(id, data as any),
        onSuccess: (_res, vars) => {
            queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
            if (vars?.id) queryClient.invalidateQueries({ queryKey: projectsKeys.detail(vars.id) });
        },
    });
};

export const useTogglePublishProject = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => togglePublishProject(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: projectsKeys.lists() });
        },
    });
};

export const useDeleteProject = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteProject(id),
        onSuccess: (_res, deletedId) => {
            qc.setQueriesData<Project[]>({ queryKey: projectsKeys.lists() }, (current) => {
                if (!Array.isArray(current)) return current;
                return current.filter((p: any) => (p?.id || p?._id) !== deletedId);
            });
            qc.removeQueries({ queryKey: projectsKeys.detail(deletedId) });
            qc.invalidateQueries({ queryKey: projectsKeys.lists() });
        },
    });
};

export const useReorderProjects = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (orderedIds: string[]) => reorderProjects(orderedIds),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: projectsKeys.lists() });
        },
        onError: () => {
            qc.invalidateQueries({ queryKey: projectsKeys.lists() });
        },
    });
};

export default useProjects;
