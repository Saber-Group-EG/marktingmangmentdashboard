import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    type ItemQueryParams,
    type Item,
    type ItemListResponse,
} from "@/api/requests/itemsService";

// Query keys
export const itemsKeys = {
    all: ["items"] as const,
    lists: () => [...itemsKeys.all, "list"] as const,
    list: (params?: ItemQueryParams) => [...itemsKeys.lists(), params] as const,
    details: () => [...itemsKeys.all, "detail"] as const,
    detail: (id: string) => [...itemsKeys.details(), id] as const,
};

/**
 * Hook to fetch items list
 */
export const useItems = (params?: ItemQueryParams) => {
    return useQuery({
        queryKey: itemsKeys.list(params),
        queryFn: () => getItems(params),
    });
};

/**
 * Hook to fetch single item
 */
export const useItem = (id: string, enabled = true) => {
    return useQuery({
        queryKey: itemsKeys.detail(id),
        queryFn: () => getItemById(id),
        enabled: !!id && enabled,
    });
};

/**
 * Hook to create item
 */
export const useCreateItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createItem,
        // Optimistic update: add the new item to all cached item lists immediately
        onMutate: async (newItem: { name: string; ar?: string; description?: string; descriptionAr?: string; category?: string }) => {
            await queryClient.cancelQueries({ queryKey: itemsKeys.lists() });

            const previous = queryClient.getQueriesData({ queryKey: itemsKeys.lists() });

            const tempId = `temp-${Date.now()}`;
            const optimisticItem: Item = {
                _id: tempId,
                name: newItem.name,
                ar: newItem.ar || "",
                description: newItem.description,
                descriptionAr: newItem.descriptionAr,
                category: newItem.category,
            };

            previous.forEach(([key]) => {
                try {
                    queryClient.setQueryData(key, (old?: ItemListResponse) => {
                        if (!old) return old;
                        return {
                            ...old,
                            data: [optimisticItem, ...old.data],
                            meta: { ...old.meta, total: (old.meta?.total || 0) + 1 },
                        } as ItemListResponse;
                    });
                } catch (err) {
                    // ignore individual cache set errors
                }
            });

            return { previous };
        },
        onError: (_err, _newItem, context: any) => {
            // rollback to previous cache state
            if (context?.previous) {
                context.previous.forEach(([key, data]: [any, any]) => {
                    try {
                        queryClient.setQueryData(key, data as unknown as ItemListResponse);
                    } catch (e) {
                        // ignore
                    }
                });
            }
        },
        onSuccess: (createdItem: Item) => {
            // Replace any temp item with the real one returned from server
            const queries = queryClient.getQueriesData({ queryKey: itemsKeys.lists() });
            queries.forEach(([key]) => {
                try {
                    queryClient.setQueryData(key, (old?: ItemListResponse) => {
                        if (!old) return old;
                        const idx = old.data.findIndex((i) => i._id?.toString().startsWith("temp-") && i.name === createdItem.name);
                        if (idx === -1) return old;
                        const newData = [...old.data];
                        newData[idx] = createdItem;
                        return { ...old, data: newData } as ItemListResponse;
                    });
                } catch (e) {
                    // ignore
                }
            });

            queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
        },
    });
};

/**
 * Hook to update item
 */
export const useUpdateItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateItem>[1] }) => updateItem(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: itemsKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
        },
    });
};

/**
 * Hook to delete item
 */
export const useDeleteItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
        },
    });
};
