import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
    getCast,
    createCast,
    updateCast,
    deleteCast,
    type CastListResponse,
    type CastQueryParams,
    type CastUpdateInput,
} from "@/api/requests/castService";
import { projectsKeys } from "./useProjectsQuery";

export const castKeys = {
    all: ["cast"] as const,
    lists: () => [...castKeys.all, "list"] as const,
    list: (params?: CastQueryParams) => [...castKeys.lists(), params ?? "all"] as const,
};

export const getCastQueryKey = (params?: CastQueryParams) => castKeys.list(params);

export const normalizeCastParams = (params?: CastQueryParams): Record<string, any> | undefined => {
    if (!params) return undefined;
    const normalized: Record<string, any> = {};
    if (typeof params.page === "number" && params.page > 0) normalized.page = params.page;
    if (typeof params.limit === "number" && params.limit > 0) normalized.limit = params.limit;
    if (typeof params.search === "string" && params.search.trim()) normalized.search = params.search.trim();
    return Object.keys(normalized).length ? normalized : undefined;
};

export const useCastCacheActions = () => {
    const queryClient = useQueryClient();

    const removeCastCache = () => {
        queryClient.removeQueries({ queryKey: castKeys.list(), exact: true });
    };

    const removeAllCastCache = () => {
        queryClient.removeQueries({ queryKey: castKeys.lists() });
    };

    const invalidateCastCache = () => {
        queryClient.invalidateQueries({ queryKey: castKeys.list(), exact: true });
    };

    return { removeCastCache, removeAllCastCache, invalidateCastCache };
};

export const useCast = (params?: CastQueryParams) => {
    const normalizedParams = normalizeCastParams(params);
    return useQuery({
        queryKey: castKeys.list(params),
        queryFn: () => getCast(normalizedParams),
    });
};

export const useCreateCast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCast,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: castKeys.lists() });
            queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
        },
    });
};

export const useUpdateCast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: CastUpdateInput }) => updateCast(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: castKeys.lists() });
            queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
        },
    });
};

export const useDeleteCast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteCast,
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: castKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: castKeys.lists() });

            previous.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: CastListResponse) => {
                    if (!old) return old;
                    const nextCast = old.cast.filter((member) => member._id !== id);
                    return {
                        ...old,
                        cast: nextCast,
                        meta: {
                            ...old.meta,
                            total: Math.max(0, (old.meta?.total || 0) - 1),
                        },
                    };
                });
            });

            return { previous };
        },
        onError: (_err, _id, context?: { previous: [QueryKey, unknown][] }) => {
            if (context?.previous) {
                context.previous.forEach(([key, data]) => {
                    queryClient.setQueryData(key, data);
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: castKeys.lists() });
            queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
        },
    });
};