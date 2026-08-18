import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
    getCast,
    createCast,
    updateCast,
    deleteCast,
    type CastListResponse,
    type CastUpdateInput,
} from "@/api/requests/castService";

export const castKeys = {
    all: ["cast"] as const,
    lists: () => [...castKeys.all, "list"] as const,
    list: () => [...castKeys.lists()] as const,
};

export const getCastQueryKey = () => castKeys.list();

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

export const useCast = () => {
    return useQuery({
        queryKey: castKeys.list(),
        queryFn: getCast,
    });
};

export const useCreateCast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCast,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: castKeys.lists() });
        },
    });
};

export const useUpdateCast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: CastUpdateInput }) => updateCast(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: castKeys.lists() });
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
        },
    });
};