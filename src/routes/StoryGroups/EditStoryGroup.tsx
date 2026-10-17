import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { StoryGroupCreate } from "@/api/interfaces/storyGroupInterface";
import { useStoryGroup, useUpdateStoryGroup } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import StoryGroupForm from "./components/StoryGroupForm";

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

const EditStoryGroup = () => {
    const { t } = useLang();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { data: group, isLoading, isError } = useStoryGroup(id);
    const updateMutation = useUpdateStoryGroup();

    const handleSubmit = async (payload: StoryGroupCreate) => {
        if (!id) return;
        await updateMutation.mutateAsync({ id, data: payload });
        navigate("/story-groups");
    };

    if (!id) {
        return (
            <div className="px-4 py-16 text-center sm:px-6 lg:px-8">
                <p className="text-light-600 dark:text-dark-300 text-sm">{tr(t, "story_group_not_found", "Story group not found.")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/65 relative overflow-hidden rounded-3xl border bg-white/90 p-6 shadow-sm sm:p-8">
                <div className="bg-light-400/20 dark:bg-light-500/10 absolute -top-20 -right-10 h-52 w-52 rounded-full blur-3xl" />
                <div className="bg-secdark-700/15 dark:bg-secdark-700/20 absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl" />
                <div className="relative flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/story-groups")}
                        className="btn-ghost w-fit gap-1.5 self-start px-0 text-sm"
                    >
                        <ArrowLeft
                            size={16}
                            className="rtl:rotate-180"
                        />
                        <span>{tr(t, "back_to_story_groups", "Back to Story Groups")}</span>
                    </button>
                    <div className="flex flex-col gap-1">
                        <span className="border-light-300/70 text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200 inline-flex w-fit items-center rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase">
                            {tr(t, "story_groups_eyebrow", "Story Studio")}
                        </span>
                        <h1 className="title text-2xl sm:text-3xl">{tr(t, "edit_story_group", "Edit Story Group")}</h1>
                        <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                            {tr(t, "edit_story_group_sub", "Update titles, cover and the ordered list of videos.")}
                        </p>
                    </div>
                </div>
            </section>

            {isLoading ? (
                <div className="text-light-500 dark:text-dark-400 flex items-center justify-center gap-2 py-12 text-sm">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    {tr(t, "loading_story_groups", "Loading story groups...")}
                </div>
            ) : isError || !group ? (
                <div className="border-light-300 dark:border-dark-600 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center">
                    <p className="text-light-600 dark:text-dark-300 text-sm">{tr(t, "story_group_not_found", "Story group not found.")}</p>
                    <button
                        type="button"
                        onClick={() => navigate("/story-groups")}
                        className="btn-secondary"
                    >
                        {tr(t, "back_to_story_groups", "Back to Story Groups")}
                    </button>
                </div>
            ) : (
                <StoryGroupForm
                    key={id}
                    initial={group}
                    submitLabel={tr(t, "save_changes", "Save")}
                    submitting={updateMutation.isPending}
                    onSubmit={handleSubmit}
                    onCancel={() => navigate("/story-groups")}
                />
            )}
        </div>
    );
};

export default EditStoryGroup;
