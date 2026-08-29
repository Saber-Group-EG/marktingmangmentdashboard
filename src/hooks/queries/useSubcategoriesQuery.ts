import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    type SubcategoryQueryParams,
    type SubcategoryListResponse,
} from "@/api/requests/subcategoriesService";

const normalizeSubcategoryParams = (params?: SubcategoryQueryParams): SubcategoryQueryParams => {
    const normalized: SubcategoryQueryParams = {};
    if (params?.parentCategory) normalized.parentCategory = params.parentCategory;
    if (typeof params?.page === "number") normalized.page = params.page;
    if (params?.search && params.search.trim()) normalized.search = params.search.trim();
    return normalized;
};

export const subcategoriesKeys = {
    all: ["subcategories"] as const,
    lists: () => [...subcategoriesKeys.all, "list"] as const,
    list: (params?: SubcategoryQueryParams) => [...subcategoriesKeys.lists(), normalizeSubcategoryParams(params)] as const,
};

export const useSubcategories = (params?: SubcategoryQueryParams) => {
    const normalizedParams = normalizeSubcategoryParams(params);
    return useQuery({
        queryKey: subcategoriesKeys.list(normalizedParams),
        queryFn: () => getSubcategories(normalizedParams),
        refetchOnMount: "always",
    });
};

export const useCreateSubcategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            name,
            parentCategory,
        }: {
            name: { en: string; ar: string };
            parentCategory: string;
        }) => createSubcategory({ name, parentCategory }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subcategoriesKeys.lists() });
        },
    });
};

export const useUpdateSubcategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: string;
            data: { name: { en: string; ar: string }; parentCategory: string };
        }) => updateSubcategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subcategoriesKeys.lists() });
        },
    });
};

export const useDeleteSubcategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteSubcategory,
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: subcategoriesKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: subcategoriesKeys.lists() });

            previous.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: SubcategoryListResponse) => {
                    if (!old) return old;
                    const nextSubcategories = old.subcategories.filter((sub) => sub._id !== id);
                    return {
                        ...old,
                        subcategories: nextSubcategories,
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
            queryClient.invalidateQueries({ queryKey: subcategoriesKeys.lists() });
        },
    });
};
