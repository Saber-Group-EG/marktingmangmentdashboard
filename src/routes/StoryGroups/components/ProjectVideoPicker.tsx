import { useMemo } from "react";
import { Check, Film, Loader2 } from "lucide-react";
import { useProject } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import { cn } from "@/utils/cn";
import { getProxiedCoverUrl } from "@/utils/proxy";
import { extractProjectVideoItems, type ProjectVideoCandidate } from "../utils/projectSource";

interface ProjectVideoPickerProps {
    projectId?: string;
    selectedUrls: string[];
    onToggle: (candidate: ProjectVideoCandidate) => void;
    disabled?: boolean;
}

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

const ProjectVideoPicker = ({ projectId, selectedUrls, onToggle, disabled = false }: ProjectVideoPickerProps) => {
    const { t } = useLang();
    const { data: project, isLoading, isError } = useProject(projectId);
    const videos = useMemo(() => extractProjectVideoItems(project?.material), [project?.material]);
    const selected = useMemo(() => new Set(selectedUrls), [selectedUrls]);

    if (!projectId) {
        return (
            <p className="border-light-300 text-light-600 dark:border-dark-600 dark:text-dark-300 rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
                {tr(t, "select_project_hint", "Select a project to see its videos.")}
            </p>
        );
    }

    if (isLoading) {
        return (
            <div className="text-light-500 dark:text-dark-400 flex items-center justify-center gap-2 py-10 text-sm">
                <Loader2
                    size={18}
                    className="animate-spin"
                />
                {tr(t, "loading_project_data", "Loading project data...")}
            </div>
        );
    }

    if (isError) {
        return <p className="text-danger-500 py-8 text-center text-sm">{tr(t, "project_load_failed", "Failed to load project videos")}</p>;
    }

    return (
        <div className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/60 rounded-2xl border bg-white/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-light-900 dark:text-dark-50 text-sm font-semibold">
                        {tr(t, "step_select_videos", "Step 2 — Select videos")}
                    </h3>
                    <p className="text-light-600 dark:text-dark-300 mt-0.5 text-xs">
                        {tr(t, "select_videos_hint", "Tap a video to add or remove it from the group.")}
                    </p>
                </div>
                <span className="border-light-200 bg-light-50 text-light-700 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {selected.size} / {videos.length}
                </span>
            </div>

            {videos.length === 0 ? (
                <p className="text-light-600 dark:text-dark-300 py-8 text-center text-sm">
                    {tr(t, "no_project_videos", "This project has no videos.")}
                </p>
            ) : (
                <ul className="grid max-h-[460px] grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-3">
                    {videos.map((video, index) => {
                        const isSelected = selected.has(video.url);
                        const label = (video.originalName || "").trim() || `${tr(t, "video", "Video")} ${index + 1}`;
                        const poster = video.thumbnail ? getProxiedCoverUrl(video.thumbnail, { width: 320, quality: 60 }) : "";

                        return (
                            <li key={`${video.url}-${index}`}>
                                <button
                                    type="button"
                                    onClick={() => onToggle(video)}
                                    disabled={disabled}
                                    aria-pressed={isSelected}
                                    className={cn(
                                        "group relative block w-full overflow-hidden rounded-xl border text-start transition-all disabled:opacity-60",
                                        isSelected
                                            ? "border-light-500 ring-light-500/50 dark:border-secdark-700 dark:ring-secdark-700/50 ring-2"
                                            : "border-light-200 hover:border-light-300 dark:border-dark-700 dark:hover:border-dark-600",
                                    )}
                                >
                                    <span className="bg-dark-950 relative block aspect-video w-full overflow-hidden">
                                        {poster ? (
                                            <img
                                                src={poster}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <video
                                                src={video.url}
                                                preload="metadata"
                                                muted
                                                playsInline
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Film
                                                size={18}
                                                className="text-white"
                                            />
                                        </span>
                                        {isSelected && (
                                            <span className="bg-light-500 dark:bg-secdark-700 absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow">
                                                <Check size={14} />
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-light-700 dark:text-dark-200 block truncate px-2 py-1.5 text-[11px] font-medium">
                                        {label}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default ProjectVideoPicker;
