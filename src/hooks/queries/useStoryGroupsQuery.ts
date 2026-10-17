import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StoryGroup, StoryGroupCreate, StoryGroupUpdate } from "@/api/interfaces/storyGroupInterface";
import { getStoryGroupId } from "@/api/interfaces/storyGroupInterface";
import {
    createStoryGroup,
    deleteStoryGroup,
    getStoryGroupById,
    getStoryGroups,
    reorderStoryGroups,
    updateStoryGroup,
} from "@/api/requests/storyGroupsService";

export const storyGroupsKeys = {
    all: ["story-groups"] as const,
    lists: () => [...storyGroupsKeys.all, "list"] as const,
    list: () => [...storyGroupsKeys.lists()] as const,
    details: () => [...storyGroupsKeys.all, "detail"] as const,
    detail: (id: string) => [...storyGroupsKeys.details(), id] as const,
};

export const useStoryGroups = (opts?: { enabled?: boolean }) => {
    return useQuery<StoryGroup[]>({
        queryKey: storyGroupsKeys.list(),
        queryFn: getStoryGroups,
        staleTime: 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        enabled: opts?.enabled ?? true,
    });
};

export const useStoryGroup = (id?: string, opts?: { enabled?: boolean }) => {
    const queryClient = useQueryClient();
    const shouldEnable = typeof opts?.enabled === "boolean" ? opts.enabled : !!id;
    const initialData = id ? queryClient.getQueryData<StoryGroup>(storyGroupsKeys.detail(id)) : undefined;

    return useQuery<StoryGroup | null>({
        queryKey: storyGroupsKeys.detail(id || ""),
        queryFn: () => getStoryGroupById(id || ""),
        enabled: shouldEnable,
        initialData,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });
};

export const useCreateStoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<StoryGroup, unknown, StoryGroupCreate>({
        mutationFn: createStoryGroup,
        onSuccess: (created) => {
            const createdId = getStoryGroupId(created);
            queryClient.setQueriesData<StoryGroup[]>({ queryKey: storyGroupsKeys.lists() }, (current) => {
                if (!Array.isArray(current)) return [created];
                return [created, ...current.filter((group) => getStoryGroupId(group) !== createdId)];
            });
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
        },
    });
};

export const useUpdateStoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<StoryGroup, unknown, { id: string; data: StoryGroupUpdate }>({
        mutationFn: ({ id, data }) => updateStoryGroup(id, data),
        onSuccess: (updated, variables) => {
            const updatedId = getStoryGroupId(updated) || variables.id;
            queryClient.setQueriesData<StoryGroup[]>({ queryKey: storyGroupsKeys.lists() }, (current) =>
                Array.isArray(current)
                    ? current.map((group) => (getStoryGroupId(group) === updatedId ? { ...group, ...updated, _id: updatedId, id: updatedId } : group))
                    : current,
            );
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.detail(updatedId) });
        },
    });
};

export const useDeleteStoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<unknown, unknown, string>({
        mutationFn: (id) => deleteStoryGroup(id),
        onSuccess: (_response, id) => {
            queryClient.setQueriesData<StoryGroup[]>({ queryKey: storyGroupsKeys.lists() }, (current) =>
                Array.isArray(current) ? current.filter((group) => getStoryGroupId(group) !== id) : current,
            );
            queryClient.removeQueries({ queryKey: storyGroupsKeys.detail(id), exact: true });
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
        },
    });
};

export const useReorderStoryGroups = () => {
    const queryClient = useQueryClient();
    return useMutation<{ success: true; orderedIds: string[] }, unknown, string[]>({
        mutationFn: (orderedIds) => reorderStoryGroups(orderedIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
        },
        onError: () => {
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
        },
    });
};
