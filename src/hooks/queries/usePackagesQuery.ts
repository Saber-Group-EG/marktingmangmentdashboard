import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getPackages,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage,
    type PackageQueryParams,
    type Package,
    type PackageListResponse,
} from "@/api/requests/packagesService";

// Query keys
export const packagesKeys = {
    all: ["packages"] as const,
    lists: () => [...packagesKeys.all, "list"] as const,
    list: (params?: PackageQueryParams) => [...packagesKeys.lists(), params] as const,
    details: () => [...packagesKeys.all, "detail"] as const,
    detail: (id: string) => [...packagesKeys.details(), id] as const,
};

/**
 * Hook to fetch packages list
 */
export const usePackages = (params?: PackageQueryParams) => {
    return useQuery({
        queryKey: packagesKeys.list(params),
        queryFn: () => getPackages(params),
    });
};

/**
 * Hook to fetch single package
 */
export const usePackage = (id: string, enabled = true) => {
    return useQuery({
        queryKey: packagesKeys.detail(id),
        queryFn: () => getPackageById(id),
        enabled: !!id && enabled,
    });
};

/**
 * Hook to create package
 */
export const useCreatePackage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPackage,
        onMutate: async (newPackage) => {
            await queryClient.cancelQueries({ queryKey: packagesKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: packagesKeys.lists() });

            const tempId = `temp-${Date.now()}`;
            const optimisticPackage: Package = {
                _id: tempId,
                nameEn: newPackage.nameEn || "",
                nameAr: newPackage.nameAr || "",
                price: newPackage.price || 0,
                description: newPackage.description,
                descriptionAr: (newPackage as any).descriptionAr,
                category: (newPackage as any).category,
                items: (newPackage.items as any) || [],
            };

            previous.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: PackageListResponse) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: [optimisticPackage, ...old.data],
                        meta: { ...old.meta, total: (old.meta?.total || 0) + 1 },
                    };
                });
            });

            return { previous };
        },
        onError: (_err, _newPackage, context: any) => {
            if (context?.previous) {
                context.previous.forEach(([key, data]: [any, any]) => {
                    queryClient.setQueryData(key, data);
                });
            }
        },
        onSuccess: (createdPackage) => {
            const queries = queryClient.getQueriesData({ queryKey: packagesKeys.lists() });
            queries.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: PackageListResponse) => {
                    if (!old) return old;
                    const idx = old.data.findIndex((p) => p._id?.toString().startsWith("temp-"));
                    if (idx === -1) return old;
                    const newData = [...old.data];
                    newData[idx] = createdPackage;
                    return { ...old, data: newData };
                });
            });
            queryClient.invalidateQueries({ queryKey: packagesKeys.lists() });
        },
    });
};

/**
 * Hook to update package
 */
export const useUpdatePackage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePackage>[1] }) => updatePackage(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: packagesKeys.lists() });
            await queryClient.cancelQueries({ queryKey: packagesKeys.detail(id) });

            const previousLists = queryClient.getQueriesData({ queryKey: packagesKeys.lists() });
            const previousDetail = queryClient.getQueryData(packagesKeys.detail(id));

            previousLists.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: PackageListResponse) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((pkg) => (pkg._id === id ? { ...pkg, ...data } : pkg)),
                    };
                });
            });

            if (previousDetail) {
                queryClient.setQueryData(packagesKeys.detail(id), (old: any) => ({ ...old, ...data }));
            }

            return { previousLists, previousDetail };
        },
        onError: (_err, { id }, context: any) => {
            if (context?.previousLists) {
                context.previousLists.forEach(([key, data]: [any, any]) => {
                    queryClient.setQueryData(key, data);
                });
            }
            if (context?.previousDetail) {
                queryClient.setQueryData(packagesKeys.detail(id), context.previousDetail);
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: packagesKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: packagesKeys.lists() });
        },
    });
};

/**
 * Hook to delete package
 */
export const useDeletePackage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePackage,
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: packagesKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: packagesKeys.lists() });

            previous.forEach(([key]) => {
                queryClient.setQueryData(key, (old?: PackageListResponse) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.filter((pkg) => pkg._id !== id),
                        meta: { ...old.meta, total: Math.max(0, (old.meta?.total || 0) - 1) },
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
            queryClient.invalidateQueries({ queryKey: packagesKeys.lists() });
        },
    });
};
