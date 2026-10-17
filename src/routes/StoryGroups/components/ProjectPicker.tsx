import { useMemo, useState } from "react";
import { Check, FolderOpen, Loader2, Search } from "lucide-react";
import type { Project } from "@/api/interfaces/projectInterface";
import { useProjectsPaginated } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import { getProxiedCoverUrl } from "@/utils/proxy";
import { getProjectCoverUrl, getProjectLocalizedTitle } from "../utils/projectSource";

interface ProjectPickerProps {
    selectedId?: string;
    onSelect: (project: Project) => void;
    disabled?: boolean;
}

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

const ProjectPicker = ({ selectedId, onSelect, disabled = false }: ProjectPickerProps) => {
    const { t, lang } = useLang();
    const [search, setSearch] = useState("");
    const { data, isLoading, isError } = useProjectsPaginated({ PageCount: "all" });
    const projects = useMemo(() => data?.data || [], [data]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return projects;
        return projects.filter((project) => {
            const title = getProjectLocalizedTitle(project);
            return [title.ar, title.en, project.name].filter(Boolean).some((value) => value.toLowerCase().includes(query));
        });
    }, [projects, search]);

    return (
        <div className="border-light-200/70 dark:border-dark-700/70 dark:bg-dark-900/60 rounded-2xl border bg-white/80 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-light-900 dark:text-dark-50 text-sm font-semibold">
                        {tr(t, "step_select_project", "Step 1 — Select a project")}
                    </h3>
                    <p className="text-light-600 dark:text-dark-300 mt-0.5 text-xs">
                        {tr(t, "project_picker_hint", "Videos are copied from the project — nothing is re-uploaded.")}
                    </p>
                </div>
                <div className="relative sm:w-64">
                    <Search className="text-light-500 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={tr(t, "search_projects", "Search projects...")}
                        disabled={disabled}
                        className="input w-full pr-3 pl-9 disabled:opacity-50"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="text-light-500 dark:text-dark-400 flex items-center justify-center gap-2 py-10 text-sm">
                    <Loader2
                        size={18}
                        className="animate-spin"
                    />
                    {tr(t, "loading_projects", "Loading projects")}
                </div>
            ) : isError ? (
                <p className="text-danger-500 py-8 text-center text-sm">{tr(t, "projects_load_failed", "Failed to load projects")}</p>
            ) : filtered.length === 0 ? (
                <p className="text-light-600 dark:text-dark-300 py-8 text-center text-sm">{tr(t, "no_projects_found", "No projects found.")}</p>
            ) : (
                <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filtered.map((project, index) => {
                        const title = getProjectLocalizedTitle(project);
                        const label =
                            ((lang === "ar" ? title.ar : title.en) || title.en || title.ar).trim() || tr(t, "untitled_project", "Untitled project");
                        const cover = getProjectCoverUrl(project);
                        const isSelected = !!selectedId && selectedId === (project.id || "");

                        return (
                            <li key={project.id || `project-${index}`}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(project)}
                                    disabled={disabled}
                                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-all disabled:opacity-50 ${
                                        isSelected
                                            ? "border-light-500 bg-light-500/5 ring-light-500/40 dark:border-secdark-700 dark:bg-secdark-700/10 dark:ring-secdark-700/50 ring-1"
                                            : "border-light-200 hover:border-light-300 hover:bg-light-50 dark:border-dark-700 dark:bg-dark-900 dark:hover:border-dark-600 dark:hover:bg-dark-800 bg-white"
                                    }`}
                                >
                                    <span className="bg-light-100 dark:bg-dark-700 h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                                        {cover ? (
                                            <img
                                                src={getProxiedCoverUrl(cover, { width: 96, quality: 60 })}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-light-500 dark:text-dark-400 flex h-full w-full items-center justify-center">
                                                <FolderOpen size={18} />
                                            </span>
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="text-light-900 dark:text-dark-50 block truncate text-sm font-semibold">{label}</span>
                                    </span>
                                    <span
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                            isSelected
                                                ? "border-light-500 bg-light-500 dark:border-secdark-700 dark:bg-secdark-700 text-white"
                                                : "border-light-300 dark:border-dark-600"
                                        }`}
                                    >
                                        {isSelected && <Check size={12} />}
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

export default ProjectPicker;
