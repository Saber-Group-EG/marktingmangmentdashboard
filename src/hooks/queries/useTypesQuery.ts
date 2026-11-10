import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTypes, createType, updateType, deleteType } from "@/api/requests/typesService";
import { projectsKeys } from "./useProjectsQuery";

export const typesKeys = {
    all: ["project-types"] as const,
    lists: () => [...typesKeys.all, "list"] as const,
    list: () => [...typesKeys.lists()] as const,
};

export const useTypes = () => {
    return useQuery({
        queryKey: typesKeys.list(),
        queryFn: getTypes,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

const useInvalidateTypeCaches = () => {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: typesKeys.lists() });
        queryClient.invalidateQueries({ queryKey: projectsKeys.types() });
    };
};

export const useCreateType = () => {
    const invalidate = useInvalidateTypeCaches();

    return useMutation({
        mutationFn: (data: { name: { en: string; ar: string } }) => createType(data),
        onSuccess: invalidate,
    });
};

export const useUpdateType = () => {
    const invalidate = useInvalidateTypeCaches();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name: { en: string; ar: string } } }) =>
            updateType(id, data),
        onSuccess: invalidate,
    });
};

export const useDeleteType = () => {
    const invalidate = useInvalidateTypeCaches();

    return useMutation({
        mutationFn: (id: string) => deleteType(id),
        onSuccess: invalidate,
    });
};
