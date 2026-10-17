import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Clapperboard, ImagePlus, Loader2, Plus } from "lucide-react";
import type { Project } from "@/api/interfaces/projectInterface";
import type { StoryGroup, StoryGroupCreate } from "@/api/interfaces/storyGroupInterface";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { useLang } from "@/hooks/useLang";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/utils/cn";
import { isDataUrl, uploadFileToR2, uploadThumbnailToR2 } from "@/utils/r2Upload";
import { getProxiedCoverUrl } from "@/utils/proxy";
import ProjectPicker from "./ProjectPicker";
import ProjectVideoPicker from "./ProjectVideoPicker";
import SelectedVideosList from "./SelectedVideosList";
import StoryPreviewCard from "./StoryPreviewCard";
import {
    buildStoryMaterials,
    createProjectDraftItem,
    createUploadDraftItem,
    isHttpUrl,
    isPendingUpload,
    releaseDraftItem,
    type DraftVideoItem,
    type ResolvedUpload,
} from "../utils/draftVideo";
import { getProjectCoverUrl, getProjectLocalizedTitle, storyGroupTitleForLang, toCoverPayload, toSubtitlePayload } from "../utils/projectSource";

const STORY_GROUP_UPLOAD_FOLDER = "Markting/storygroups";

type StoryGroupFormMode = "inherit" | "new";

interface DraftCover {
    url?: string;
    file?: File;
    previewUrl?: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
}

interface StoryGroupFormProps {
    initial?: StoryGroup | null;
    submitLabel: string;
    submitting?: boolean;
    onSubmit: (payload: StoryGroupCreate) => Promise<void>;
    onCancel: () => void;
}

const withCount = (template: string, count: number): string => template.replace("{count}", String(count));

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

const StoryGroupForm = ({ initial, submitLabel, submitting = false, onSubmit, onCancel }: StoryGroupFormProps) => {
    const { t, lang } = useLang();
    const upload = useUploadProgress();

    const [mode, setMode] = useState<StoryGroupFormMode>("inherit");
    const [titleAr, setTitleAr] = useState(initial?.title.ar || "");
    const [titleEn, setTitleEn] = useState(initial?.title.en || "");
    const [subtitleAr, setSubtitleAr] = useState(initial?.subtitle?.ar || "");
    const [subtitleEn, setSubtitleEn] = useState(initial?.subtitle?.en || "");
    const [cover, setCover] = useState<DraftCover>(() => ({
        url: initial?.coverImage?.url,
        mimeType: initial?.coverImage?.mimeType,
        size: initial?.coverImage?.size,
        originalName: initial?.coverImage?.originalName,
    }));
    // Only an explicit click on "Remove" may delete the stored cover; a
    // non-http stored URL alone must never produce the "remove cover" payload.
    const [coverRemoved, setCoverRemoved] = useState(false);
    const [items, setItems] = useState<DraftVideoItem[]>(() =>
        (initial?.material || [])
            .filter((material) => isHttpUrl(material.url))
            .map((material) =>
                createProjectDraftItem({
                    url: material.url,
                    mimeType: material.mimeType,
                    size: material.size,
                    originalName: material.originalName,
                    thumbnail: material.thumbnail,
                }),
            ),
    );
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState("");

    const disabled = submitting || upload.open || preparing;
    const selectedUrls = useMemo(() => items.map((item) => item.url).filter(isHttpUrl), [items]);
    const unsupportedMaterialCount = useMemo(
        // Loaded material can never be upload-pending (no File), so anything
        // non-http was filtered out of `items` on load and would be silently
        // dropped from the next save.
        () => (initial?.material || []).filter((material) => !isHttpUrl(material.url)).length,
        [initial],
    );
    const coverUpdateUnsupported = !coverRemoved && !cover.file && !!cover.url && !isHttpUrl(cover.url);
    const previewTitle = storyGroupTitleForLang({ ar: titleAr, en: titleEn }, lang);
    const previewCover = cover.previewUrl || cover.url || "";

    const applyCoverUrl = (url?: string) => {
        setCover((previous) => {
            if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
            if (!url) return {};
            return {
                url,
                mimeType: previous.mimeType,
                size: previous.size,
                originalName: previous.originalName,
            };
        });
    };

    const handleProjectSelect = (project: Project) => {
        setSelectedProjectId(project.id || undefined);

        const title = getProjectLocalizedTitle(project);
        const ar = (title.ar || title.en || "").trim();
        const en = (title.en || title.ar || "").trim();
        if (ar) setTitleAr(ar);
        if (en) setTitleEn(en);

        const projectCover = getProjectCoverUrl(project);
        if (projectCover) {
            setCoverRemoved(false);
            applyCoverUrl(projectCover);
        }
    };

    const handleCoverSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setCoverRemoved(false);
        setCover((previous) => {
            if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
            return {
                file,
                previewUrl: URL.createObjectURL(file),
                mimeType: file.type,
                size: file.size,
                originalName: file.name,
            };
        });
    };

    const handleVideoFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (files.length === 0) return;

        setPreparing(true);
        setError("");
        try {
            const drafts = await Promise.all(files.map((file) => createUploadDraftItem(file)));
            setItems((previous) => [...previous, ...drafts]);
        } catch (cause) {
            setError(getApiErrorMessage(cause, tr(t, "video_prepare_failed", "Failed to read video files")));
        } finally {
            setPreparing(false);
        }
    };

    const handleItemsChange = (next: DraftVideoItem[]) => {
        const nextKeys = new Set(next.map((item) => item.key));
        items.forEach((item) => {
            if (!nextKeys.has(item.key)) releaseDraftItem(item);
        });
        setItems(next);
    };

    const handleModeChange = (next: StoryGroupFormMode) => {
        if (next === mode) return;
        setMode(next);
        setError("");
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (disabled) return;
        setError("");

        const finalTitleAr = (titleAr || titleEn || "").trim();
        const finalTitleEn = (titleEn || titleAr || "").trim();
        if (!finalTitleAr || !finalTitleEn) {
            setError(tr(t, "story_group_title_required", "Both Arabic and English titles are required"));
            return;
        }
        if (items.length === 0) {
            setError(tr(t, "story_group_videos_required", "Select at least one video"));
            return;
        }

        const pending = items.filter(isPendingUpload);
        const coverNeedsUpload = !!cover.file && !isHttpUrl(cover.url);
        const resolved = new Map<string, ResolvedUpload>();
        let resolvedCoverUrl = cover.url || "";
        let coverMeta: { mimeType?: string; size?: number; originalName?: string } = {};
        let coverUploadCompleted = false;

        try {
            if (pending.length > 0 || coverNeedsUpload) {
                try {
                    await upload.run({
                        title: tr(t, "uploading_story_assets", "Uploading story group assets..."),
                        label: pending.length > 0 ? `${pending.length} ${tr(t, "story_card_videos", "videos")}` : tr(t, "cover_image", "Cover image"),
                        task: async (report) => {
                            const totalSteps = pending.length + (coverNeedsUpload ? 1 : 0);
                            let completed = 0;
                            const reportFileProgress = (percent: number) => report(Math.round(((completed + percent / 100) / totalSteps) * 100));
                            const reportStep = () => {
                                completed += 1;
                                report(Math.round((completed / totalSteps) * 100));
                            };

                            for (const item of pending) {
                                const uploaded = await uploadFileToR2(item.file, {
                                    fileName: item.originalName || `story-video-${Date.now()}.mp4`,
                                    folder: STORY_GROUP_UPLOAD_FOLDER,
                                    resourceType: "video",
                                    onProgress: reportFileProgress,
                                });

                                let thumbnailUrl: string | undefined;
                                if (item.thumbnail && isDataUrl(item.thumbnail)) {
                                    const baseName = (item.originalName || "story-video").replace(/\.[^.]+$/, "");
                                    const uploadedThumbnail = await uploadThumbnailToR2(item.thumbnail, {
                                        fileName: `${baseName}-thumb.jpg`,
                                        folder: STORY_GROUP_UPLOAD_FOLDER,
                                        resourceType: "image",
                                    });
                                    thumbnailUrl = uploadedThumbnail.url;
                                }

                                resolved.set(item.key, { url: uploaded.url, thumbnail: thumbnailUrl });
                                reportStep();
                            }

                            if (coverNeedsUpload && cover.file) {
                                const uploadedCover = await uploadFileToR2(cover.file, {
                                    fileName: cover.originalName || `story-cover-${Date.now()}.jpg`,
                                    folder: STORY_GROUP_UPLOAD_FOLDER,
                                    resourceType: "image",
                                    onProgress: reportFileProgress,
                                });
                                resolvedCoverUrl = uploadedCover.url;
                                coverMeta = {
                                    mimeType: uploadedCover.mimeType,
                                    size: uploadedCover.size,
                                    originalName: uploadedCover.originalName,
                                };
                                coverUploadCompleted = true;
                                reportStep();
                            }
                        },
                    });
                } finally {
                    // Persist whatever reached R2 even when the task throws
                    // mid-sequence, so a retried submit skips files that are
                    // already uploaded instead of uploading them twice.
                    if (resolved.size > 0) {
                        setItems((previous) =>
                            previous.map((item) => {
                                const uploadResult = resolved.get(item.key);
                                if (!uploadResult) return item;
                                return {
                                    ...item,
                                    url: uploadResult.url,
                                    thumbnail: uploadResult.thumbnail ?? item.thumbnail,
                                    file: undefined,
                                };
                            }),
                        );
                    }
                    if (coverUploadCompleted && resolvedCoverUrl) {
                        setCover((previous) => ({
                            ...previous,
                            url: resolvedCoverUrl,
                            ...coverMeta,
                            file: undefined,
                        }));
                    }
                }
            }

            const material = buildStoryMaterials(items, resolved);
            if (material.length === 0) {
                setError(tr(t, "story_group_videos_required", "Select at least one video"));
                return;
            }

            const subtitle = toSubtitlePayload({ ar: subtitleAr, en: subtitleEn });
            const coverPayload = toCoverPayload({
                url: resolvedCoverUrl,
                mimeType: coverMeta.mimeType ?? cover.mimeType,
                size: coverMeta.size ?? cover.size,
                originalName: coverMeta.originalName ?? cover.originalName,
            });

            const payload: StoryGroupCreate = {
                title: { ar: finalTitleAr, en: finalTitleEn },
                material,
                ...(subtitle ? { subtitle } : {}),
                // An empty url is how the schema expresses "remove the cover" on
                // update, so only an explicit removal may send it. An unsupported
                // url omits the key entirely and the backend keeps the cover.
                ...(coverRemoved && initial?.coverImage?.url ? { coverImage: { url: "" } } : coverPayload ? { coverImage: coverPayload } : {}),
            };

            await onSubmit(payload);
        } catch (cause) {
            setError(getApiErrorMessage(cause, tr(t, "story_group_save_failed", "Failed to save story group")));
        }
    };

    const modeOptionClass = (active: boolean) =>
        cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
            active
                ? "bg-white text-light-700 shadow-sm dark:bg-dark-700 dark:text-dark-50"
                : "text-light-600 hover:text-light-900 dark:text-dark-400 dark:hover:text-dark-100",
        );

    return (
        <form
            onSubmit={handleSubmit}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
            <div className="min-w-0 space-y-6">
                {error && (
                    <div className="border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200 rounded-lg border px-4 py-3">
                        {error}
                    </div>
                )}

                <section className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/65 rounded-2xl border bg-white/90 p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-light-900 dark:text-dark-50 text-sm font-semibold">
                                {tr(t, "story_group_source", "Where do the videos come from?")}
                            </h2>
                            <p className="text-light-600 dark:text-dark-300 mt-0.5 text-xs">
                                {tr(t, "story_group_source_hint", "Inherit videos from an existing project or build the group from scratch.")}
                            </p>
                        </div>
                        <div className="bg-light-100 dark:bg-dark-800 inline-flex rounded-xl p-1">
                            <button
                                type="button"
                                onClick={() => handleModeChange("inherit")}
                                disabled={disabled}
                                className={modeOptionClass(mode === "inherit")}
                            >
                                {tr(t, "mode_inherit_from_project", "Inherit from project")}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeChange("new")}
                                disabled={disabled}
                                className={modeOptionClass(mode === "new")}
                            >
                                {tr(t, "mode_create_new", "Create new")}
                            </button>
                        </div>
                    </div>

                    {mode === "inherit" ? (
                        <div className="mt-4 space-y-4">
                            {selectedProjectId ? (
                                <div className="border-light-200 bg-light-50 dark:border-dark-700 dark:bg-dark-800 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                                    <span className="text-light-800 dark:text-dark-200 inline-flex items-center gap-2 text-sm font-medium">
                                        <Clapperboard
                                            size={15}
                                            className="shrink-0"
                                        />
                                        {tr(t, "inherit_project_selected", "Videos are copied from the selected project")}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProjectId(undefined)}
                                        disabled={disabled}
                                        className="btn-ghost h-8 rounded-lg px-3 text-xs disabled:opacity-50"
                                    >
                                        {tr(t, "change_project", "Change project")}
                                    </button>
                                </div>
                            ) : (
                                <ProjectPicker
                                    selectedId={selectedProjectId}
                                    onSelect={handleProjectSelect}
                                    disabled={disabled}
                                />
                            )}

                            <ProjectVideoPicker
                                projectId={selectedProjectId}
                                selectedUrls={selectedUrls}
                                disabled={disabled}
                                onToggle={(candidate) => {
                                    setItems((previous) => {
                                        const exists = previous.some((item) => item.url === candidate.url);
                                        if (exists) {
                                            const target = previous.find((item) => item.url === candidate.url);
                                            if (target) releaseDraftItem(target);
                                            return previous.filter((item) => item.url !== candidate.url);
                                        }
                                        return [...previous, createProjectDraftItem(candidate)];
                                    });
                                }}
                            />
                        </div>
                    ) : (
                        <p className="border-light-300 text-light-600 dark:border-dark-600 dark:text-dark-300 mt-4 rounded-xl border border-dashed px-4 py-4 text-sm">
                            {tr(
                                t,
                                "create_new_hint",
                                "Enter the titles below, optionally upload a cover image, then add the videos you want in this story group.",
                            )}
                        </p>
                    )}
                </section>

                <section className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/65 rounded-2xl border bg-white/90 p-4 shadow-sm sm:p-5">
                    <h2 className="text-light-900 dark:text-dark-50 mb-4 text-sm font-semibold">
                        {tr(t, "story_group_details", "Story group details")}
                    </h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-1.5 block text-sm font-medium">
                                {tr(t, "story_group_title_en", "Title (English)")} <span className="text-danger-500">*</span>
                            </label>
                            <input
                                value={titleEn}
                                onChange={(event) => setTitleEn(event.target.value)}
                                disabled={disabled}
                                placeholder={tr(t, "story_group_title_en", "Title (English)")}
                                className="input w-full disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-1.5 block text-sm font-medium">
                                {tr(t, "story_group_title_ar", "Title (Arabic)")} <span className="text-danger-500">*</span>
                            </label>
                            <input
                                value={titleAr}
                                onChange={(event) => setTitleAr(event.target.value)}
                                disabled={disabled}
                                dir="rtl"
                                placeholder={tr(t, "story_group_title_ar", "Title (Arabic)")}
                                className="input w-full disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-1.5 block text-sm font-medium">
                                {tr(t, "story_group_subtitle_en", "Subtitle (English)")}
                            </label>
                            <input
                                value={subtitleEn}
                                onChange={(event) => setSubtitleEn(event.target.value)}
                                disabled={disabled}
                                placeholder={tr(t, "story_group_subtitle_optional", "Optional")}
                                className="input w-full disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-1.5 block text-sm font-medium">
                                {tr(t, "story_group_subtitle_ar", "Subtitle (Arabic)")}
                            </label>
                            <input
                                value={subtitleAr}
                                onChange={(event) => setSubtitleAr(event.target.value)}
                                disabled={disabled}
                                dir="rtl"
                                placeholder={tr(t, "story_group_subtitle_optional", "Optional")}
                                className="input w-full disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="text-light-700 dark:text-dark-300 mb-1.5 block text-sm font-medium">
                            {tr(t, "cover_image", "Cover image")}
                        </label>
                        <div className="mb-2 flex items-center gap-3">
                            {previewCover ? (
                                <img
                                    src={getProxiedCoverUrl(previewCover, { width: 160, quality: 70 })}
                                    alt=""
                                    className="border-light-200 dark:border-dark-700 h-16 w-16 rounded-xl border object-cover"
                                />
                            ) : (
                                <div className="bg-light-100 text-light-500 dark:bg-dark-700 dark:text-dark-400 flex h-16 w-16 items-center justify-center rounded-xl">
                                    <ImagePlus size={22} />
                                </div>
                            )}
                            {previewCover && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCoverRemoved(true);
                                        applyCoverUrl(undefined);
                                    }}
                                    disabled={disabled}
                                    className="btn-ghost h-8 rounded-lg px-3 text-xs disabled:opacity-50"
                                >
                                    {tr(t, "remove_cover", "Remove")}
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverSelect}
                            disabled={disabled}
                            className="input w-full disabled:opacity-50"
                        />
                        {coverUpdateUnsupported && (
                            <p className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 mt-2 rounded-lg border px-4 py-3 text-sm">
                                {tr(
                                    t,
                                    "story_group_cover_unsupported_warning",
                                    "The current cover image can't be updated until you replace or remove it.",
                                )}
                            </p>
                        )}
                    </div>
                </section>

                <section className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/65 rounded-2xl border bg-white/90 p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-light-900 dark:text-dark-50 text-sm font-semibold">{tr(t, "add_more_videos", "Add more videos")}</h2>
                            <p className="text-light-600 dark:text-dark-300 mt-0.5 text-xs">
                                {tr(t, "add_more_videos_hint", "New files are uploaded to the story groups folder when you save.")}
                            </p>
                        </div>
                        <label className={cn("btn-secondary cursor-pointer rounded-xl text-sm", disabled && "pointer-events-none opacity-50")}>
                            {preparing ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <Plus size={16} />
                            )}
                            <span>{tr(t, "add_videos", "Add videos")}</span>
                            <input
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleVideoFiles}
                                disabled={disabled}
                                className="hidden"
                            />
                        </label>
                    </div>

                    <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-light-500 dark:text-dark-400 text-xs font-semibold tracking-[0.08em] uppercase">
                                {tr(t, "selected_videos", "Selected videos")}
                            </h3>
                            <span className="border-light-200 bg-light-50 text-light-700 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                                {items.length}
                            </span>
                        </div>
                        {unsupportedMaterialCount > 0 && (
                            <div className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 mb-2 rounded-lg border px-4 py-3 text-sm">
                                {unsupportedMaterialCount === 1
                                    ? tr(t, "story_group_unsupported_item_warning", "1 item has an unsupported media URL and will not be saved.")
                                    : withCount(
                                          tr(
                                              t,
                                              "story_group_unsupported_items_warning",
                                              "{count} items have unsupported media URLs and will not be saved.",
                                          ),
                                          unsupportedMaterialCount,
                                      )}
                            </div>
                        )}
                        <SelectedVideosList
                            items={items}
                            onChange={handleItemsChange}
                            disabled={disabled}
                        />
                    </div>
                </section>

                <div className="max-w-[240px] lg:hidden">
                    <StoryPreviewCard
                        title={previewTitle}
                        videoCount={items.length}
                        coverUrl={previewCover}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={disabled}
                        className="btn-secondary disabled:opacity-50"
                    >
                        {tr(t, "cancel", "Cancel")}
                    </button>
                    <button
                        type="submit"
                        disabled={disabled}
                        className="btn-primary min-w-40 disabled:opacity-50"
                    >
                        {submitting || upload.open ? (
                            <Loader2
                                size={16}
                                className="animate-spin"
                            />
                        ) : (
                            <Check size={16} />
                        )}
                        <span>{submitLabel}</span>
                    </button>
                </div>
            </div>

            <aside className="hidden space-y-2 self-start lg:sticky lg:top-6 lg:block">
                <h3 className="text-light-500 dark:text-dark-400 text-xs font-semibold tracking-[0.08em] uppercase">
                    {tr(t, "live_preview", "Live preview")}
                </h3>
                <StoryPreviewCard
                    title={previewTitle}
                    videoCount={items.length}
                    coverUrl={previewCover}
                />
                <p className="text-light-600 dark:text-dark-300 text-xs">
                    {tr(t, "live_preview_hint", "The top bar draws one segment per video in this group.")}
                </p>
            </aside>

            <UploadProgressOverlay
                open={upload.open}
                progress={upload.progress}
                estimatedSecondsLeft={upload.estimatedSecondsLeft}
                title={upload.title || tr(t, "uploading_story_assets", "Uploading story group assets...")}
                label={upload.label}
            />
        </form>
    );
};

export default StoryGroupForm;
