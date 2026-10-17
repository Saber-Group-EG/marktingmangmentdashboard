import { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Edit2, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { getStoryGroupId, type StoryGroup } from "@/api/interfaces/storyGroupInterface";
import { storyGroupsKeys, useDeleteStoryGroup, useReorderStoryGroups, useStoryGroups } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import { getApiErrorMessage } from "@/utils/apiError";
import { showConfirm } from "@/utils/swal";
import StoryPreviewCard from "./components/StoryPreviewCard";
import { storyGroupTitleForLang } from "./utils/projectSource";

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

const orderByValue = (group: StoryGroup): number =>
    typeof group.order === "number" && Number.isFinite(group.order) ? group.order : Number.MAX_SAFE_INTEGER;

const compareByOrder = (a: StoryGroup, b: StoryGroup): number => {
    const orderDiff = orderByValue(a) - orderByValue(b);
    if (orderDiff !== 0) return orderDiff;
    return storyGroupTitleForLang(a.title, "en").localeCompare(storyGroupTitleForLang(b.title, "en"));
};

type SortableStoryGroupCardProps = {
    group: StoryGroup;
    title: string;
    videoCount: number;
    reorderLabel: string;
    editLabel: string;
    deleteLabel: string;
    disabled: boolean;
    onEdit: () => void;
    onRemove: () => void;
};

const SortableStoryGroupCard = ({
    group,
    title,
    videoCount,
    reorderLabel,
    editLabel,
    deleteLabel,
    disabled,
    onEdit,
    onRemove,
}: SortableStoryGroupCardProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: getStoryGroupId(group),
        disabled,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                zIndex: isDragging ? 50 : undefined,
                opacity: isDragging ? 0.5 : 1,
            }}
            className="flex flex-col"
        >
            <StoryPreviewCard
                title={title}
                videoCount={videoCount}
                coverUrl={group.coverImage?.url}
            />
            <div className="border-light-200 dark:border-dark-700 dark:bg-dark-900 mt-2 flex items-center justify-between gap-2 rounded-xl border bg-white px-2 py-1.5 shadow-sm">
                <button
                    type="button"
                    aria-label={reorderLabel}
                    disabled={disabled}
                    {...attributes}
                    {...listeners}
                    className={`text-light-500 dark:text-dark-400 shrink-0 touch-none rounded-lg p-1.5 ${
                        disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"
                    }`}
                >
                    <GripVertical size={16} />
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        aria-label={editLabel}
                        className="btn-ghost rounded-lg p-1.5"
                    >
                        <Edit2 size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label={deleteLabel}
                        className="btn-ghost text-danger-500 rounded-lg p-1.5"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const StoryGroupsPage = () => {
    const { t, lang } = useLang();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [error, setError] = useState("");
    const { data: groups = [], isLoading, isError } = useStoryGroups();
    const sortedGroups = useMemo(() => [...groups].sort(compareByOrder), [groups]);

    const deleteMutation = useDeleteStoryGroup();
    const reorderMutation = useReorderStoryGroups();

    const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const isSaving = deleteMutation.isPending || reorderMutation.isPending;

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id || isSaving) return;

        const oldIndex = sortedGroups.findIndex((group) => getStoryGroupId(group) === active.id);
        const newIndex = sortedGroups.findIndex((group) => getStoryGroupId(group) === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(sortedGroups, oldIndex, newIndex).map((group, index) => ({
            ...group,
            order: index,
        }));

        queryClient.setQueriesData<StoryGroup[]>({ queryKey: storyGroupsKeys.lists() }, () => reordered);

        try {
            await reorderMutation.mutateAsync(reordered.map((group) => getStoryGroupId(group)));
        } catch (cause) {
            setError(getApiErrorMessage(cause, tr(t, "story_group_reorder_failed", "Failed to update order")));
            queryClient.invalidateQueries({ queryKey: storyGroupsKeys.lists() });
        }
    };

    const handleRemove = async (group: StoryGroup) => {
        const confirmed = await showConfirm(tr(t, "confirm_delete_story_group", "Delete this story group?"), t("yes") || "Yes", t("no") || "No");
        if (!confirmed) return;

        try {
            setError("");
            await deleteMutation.mutateAsync(getStoryGroupId(group));
        } catch (cause) {
            setError(getApiErrorMessage(cause, tr(t, "story_group_delete_failed", "Failed to delete story group")));
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/65 relative overflow-hidden rounded-3xl border bg-white/90 p-6 shadow-sm sm:p-8">
                <div className="bg-light-400/20 dark:bg-light-500/10 absolute -top-20 -right-10 h-52 w-52 rounded-full blur-3xl" />
                <div className="bg-secdark-700/15 dark:bg-secdark-700/20 absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl" />
                <div className="relative flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <span className="border-light-300/70 text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200 inline-flex w-fit items-center rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase">
                                {tr(t, "story_groups_eyebrow", "Story Studio")}
                            </span>
                            <h1 className="title text-2xl sm:text-3xl">{tr(t, "Story Groups", "Story Groups")}</h1>
                            <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                                {tr(
                                    t,
                                    "story_groups_page_sub",
                                    "Group videos into story-style reels and drag to set their order on the landing page.",
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/story-groups/add")}
                            className="btn-primary w-full sm:w-auto"
                        >
                            <Plus size={16} />
                            <span>{tr(t, "create_story_group", "Create Story Group")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {error && (
                <div className="border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200 rounded-lg border px-4 py-3">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="text-light-500 dark:text-dark-400 flex items-center justify-center gap-2 py-12 text-sm">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    {tr(t, "loading_story_groups", "Loading story groups...")}
                </div>
            ) : isError ? (
                <p className="text-danger-500 py-12 text-center text-sm">{tr(t, "story_groups_load_failed", "Failed to load story groups")}</p>
            ) : sortedGroups.length === 0 ? (
                <div className="border-light-300 dark:border-dark-600 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center">
                    <p className="text-light-600 dark:text-dark-300 text-sm">
                        {tr(t, "story_groups_empty", "No story groups yet. Create your first one.")}
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate("/story-groups/add")}
                        className="btn-primary"
                    >
                        <Plus size={16} />
                        <span>{tr(t, "create_story_group", "Create Story Group")}</span>
                    </button>
                </div>
            ) : (
                <DndContext
                    sensors={dragSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortedGroups.map((group) => getStoryGroupId(group))}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {sortedGroups.map((group) => (
                                <SortableStoryGroupCard
                                    key={getStoryGroupId(group)}
                                    group={group}
                                    title={storyGroupTitleForLang(group.title, lang)}
                                    videoCount={group.material?.length ?? 0}
                                    reorderLabel={tr(t, "reorder_story_group", "Reorder story group")}
                                    editLabel={tr(t, "edit_story_group", "Edit story group")}
                                    deleteLabel={tr(t, "delete_story_group", "Delete story group")}
                                    disabled={isSaving}
                                    onEdit={() => navigate(`/story-groups/${getStoryGroupId(group)}/edit`)}
                                    onRemove={() => handleRemove(group)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
};

export default StoryGroupsPage;
