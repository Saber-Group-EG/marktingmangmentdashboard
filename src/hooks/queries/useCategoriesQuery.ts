import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    type CategoryQueryParams,
    type Category,
    type CategoryListResponse,
} from "@/api/requests/categoriesService";

const normalizeCategoryParams = (params?: CategoryQueryParams): CategoryQueryParams => {
    const normalized: CategoryQueryParams = {};
    if (params?.type) normalized.type = params.type;
    if (typeof params?.page === "number") normalized.page = params.page;
    // Removed limit parameter
    if (params?.search && params.search.trim()) normalized.search = params.search.trim();
    return normalized;
};

export const categoriesKeys = {
    all: ["categories"] as const,
    lists: () => [...categoriesKeys.all, "list"] as const,
    list: (params?: CategoryQueryParams) => [...categoriesKeys.lists(), normalizeCategoryParams(params)] as const,
};

export const getCategoriesQueryKey = (params?: CategoryQueryParams) => categoriesKeys.list(params);

export const useCategoriesCacheActions = () => {
    const queryClient = useQueryClient();

    const removeCategoriesCache = (params?: CategoryQueryParams) => {
        queryClient.removeQueries({ queryKey: categoriesKeys.list(params), exact: true });
    };

    const removeAllCategoriesCache = () => {
        queryClient.removeQueries({ queryKey: categoriesKeys.lists() });
    };

    const invalidateCategoriesCache = (params?: CategoryQueryParams) => {
        queryClient.invalidateQueries({ queryKey: categoriesKeys.list(params), exact: true });
    };

    return { removeCategoriesCache, removeAllCategoriesCache, invalidateCategoriesCache };
};

export const useCategories = (params?: CategoryQueryParams) => {
    const normalizedParams = normalizeCategoryParams(params);
    return useQuery({
        queryKey: categoriesKeys.list(normalizedParams),
        queryFn: () => getCategories(normalizedParams),
    });
};

export const useCreateCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            name,
            type,
        }: {
            name: { en: string; ar: string };
            type: Category["type"];
        }) => createCategory({ name, type }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() });
        },
    });
};

export const useUpdateCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: string;
            data: { name: { en: string; ar: string }; type: Category["type"] };
        }) => updateCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() });
        },
    });
};

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteCategory,
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: categoriesKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: categoriesKeys.lists() });

            previous.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: CategoryListResponse) => {
                    if (!old) return old;
                    const nextCategories = old.categories.filter((category) => category._id !== id);
                    return {
                        ...old,
                        categories: nextCategories,
                        meta: {
                            ...old.meta,
                            total: Math.max(0, (old.meta?.total || 0) - 1),
                        },
                    };
                });
            });

            return { previous };
        },
        onError: (_err, _id, context: any) => {
            if (context?.previous) {
                context.previous.forEach(([key, data]: [any, any]) => {
                    queryClient.setQueryData(key, data);
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() });
        },
    });
};