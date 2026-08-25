import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, RefreshCw, GripVertical, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useNavigate, Link } from "react-router-dom";
import { useLang } from "@/hooks/useLang";
import { useProjects, useProjectCast, useReorderProjects, useDeleteProject, useProjectCompanies, useTogglePublishProject } from "@/hooks/queries";
import { showConfirm, showAlert } from "@/utils/swal";

const PROJECT_CARD_TYPE = "PROJECT_CARD";

const getProjectId = (p: any): string => p?.id || p?._id || "";

interface SortableProjectCardProps {
    project: any;
    dragIdRef: React.RefObject<string | null>;
    onMove: (dragId: string, hoverId: string) => void;
    onDragStart: () => void;
    onDrop: () => void;
    children: React.ReactNode;
}

const SortableProjectCard: React.FC<SortableProjectCardProps> = ({
    project,
    dragIdRef,
    onMove,
    onDragStart,
    onDrop,
    children,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const id = getProjectId(project);

    const [{ isDragging }, drag] = useDrag({
        type: PROJECT_CARD_TYPE,
        item: () => {
            dragIdRef.current = id;
            onDragStart();
            return { id };
        },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        end: () => {
            onDrop();
            dragIdRef.current = null;
        },
    });

    const [, drop] = useDrop({
        accept: PROJECT_CARD_TYPE,
        hover: (item: any, monitor) => {
            if (!ref.current) return;
            const offset = monitor.getClientOffset();
            if (!offset) return;

            const rect = ref.current.getBoundingClientRect();
            if (offset.x < rect.left || offset.x > rect.right || offset.y < rect.top || offset.y > rect.bottom) {
                return;
            }

            const dragId = dragIdRef.current;
            if (!dragId || dragId === id) return;

            onMove(dragId, id);
        },
    });

    drag(drop(ref));

    return (
        <motion.div
            ref={ref}
            layout
            initial={false}
            animate={{ opacity: isDragging ? 0.4 : 1, scale: isDragging ? 0.97 : 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
        >
            {children}
        </motion.div>
    );
};

const ProjectsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [searchTerm, setSearchTerm] = useState<string>("");
    const [companyFilter, setCompanyFilter] = useState<string[]>([]);
    const { data: projects = [], isLoading, error, refetch } = useProjects();
    const { data: projectCast = [] } = useProjectCast();
    const { data: allProjectCompanies = [] } = useProjectCompanies();
    const { mutate: reorderProjects } = useReorderProjects();
    const deleteProject = useDeleteProject();
    const togglePublish = useTogglePublishProject();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Only show companies that are actually used in projects
    const usedCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        projects.forEach((p: any) => {
            const c = p.company;
            if (!c) return;
            if (typeof c === "string") ids.add(c);
            else if (c?._id) ids.add(c._id);
            else if (c?.id) ids.add(c.id);
        });
        return ids;
    }, [projects]);

    const usedProjectCompanies = useMemo(
        () => allProjectCompanies.filter((pc: any) => usedCompanyIds.has(pc._id || pc.id)),
        [allProjectCompanies, usedCompanyIds]
    );

    const handleTogglePublish = (project: any) => {
        const id = getProjectId(project);
        if (!id) return;
        const newPublished = !project.published;
        // Optimistic update
        setOrderedProjects((prev) =>
            prev.map((p: any) => (getProjectId(p) === id ? { ...p, published: newPublished } : p))
        );
        togglePublish.mutate(id, {
            onError: () => {
                // Revert on error
                setOrderedProjects((prev) =>
                    prev.map((p: any) => (getProjectId(p) === id ? { ...p, published: !newPublished } : p))
                );
                showAlert(tr("failed_to_toggle", "Failed to update publish status"), "error");
            },
        });
    };

    const handleDelete = async (project: any) => {
        const id = getProjectId(project);
        if (!id || deletingId) return;
        const name = localizedText(project.localizedName || project.name) || tr("untitled", "Untitled");
        const confirmed = await showConfirm(tr("delete_confirm_msg", 'Delete "{name}"? This cannot be undone.').replace("{name}", name), tr("delete_confirm", "Delete"), tr("cancel_confirm", "Cancel"));
        if (!confirmed) return;
        setDeletingId(id);
        deleteProject.mutate(id, {
            onSettled: () => setDeletingId(null),
        });
    };

    const [orderedProjects, setOrderedProjects] = useState<any[]>([]);
    const orderedProjectsRef = useRef<any[]>([]);

    useEffect(() => {
        const sorted = [...projects].sort(
            (a: any, b: any) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
        );
        setOrderedProjects(sorted);
    }, [projects]);

    useEffect(() => {
        orderedProjectsRef.current = orderedProjects;
    }, [orderedProjects]);

    const total = projects.length;
    const published = projects.filter((p: any) => p.published).length;
    const drafts = total - published;

    const localizedText = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") return value[lang] || value.en || value.ar || value.name || "";
        return "";
    };

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return orderedProjects.filter((p: any) => {
            const name = localizedText(p?.localizedName || p?.name).toLowerCase();
            const category = localizedText(p?.category).toLowerCase();
            const matchesSearch = !q || name.includes(q) || category.includes(q);
            let matchesCompany = true;
            if (companyFilter.length > 0) {
                const c = p.company;
                const cid = typeof c === "string" ? c : c?._id || c?.id || "";
                matchesCompany = companyFilter.includes(cid);
            }
            return matchesSearch && matchesCompany;
        });
    }, [orderedProjects, searchTerm, companyFilter]);

    const toggleCompanyFilter = (companyId: string) => {
        setCompanyFilter((prev) =>
            prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
        );
    };

    const lastSwapRef = useRef<{ dragId: string; hoverId: string } | null>(null);
    const orderChangedRef = useRef(false);

    const handleMove = useCallback((dragId: string, hoverId: string) => {
        if (lastSwapRef.current && lastSwapRef.current.dragId === dragId && lastSwapRef.current.hoverId === hoverId) return;
        lastSwapRef.current = { dragId, hoverId };

        setOrderedProjects((prev) => {
            const dragIndex = prev.findIndex((p: any) => getProjectId(p) === dragId);
            const hoverIndex = prev.findIndex((p: any) => getProjectId(p) === hoverId);
            if (dragIndex < 0 || hoverIndex < 0 || dragIndex === hoverIndex) return prev;

            orderChangedRef.current = true;

            const next = [...prev];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(hoverIndex, 0, moved);
            return next;
        });
    }, []);

    const handleDragStart = useCallback(() => {
        orderChangedRef.current = false;
        lastSwapRef.current = null;
    }, []);

    const handleDrop = useCallback(() => {
        if (!orderChangedRef.current) return;
        orderChangedRef.current = false;
        lastSwapRef.current = null;

        const orderedIds = orderedProjectsRef.current.map((p: any) => getProjectId(p)).filter(Boolean);
        if (orderedIds.length) {
            reorderProjects(orderedIds, {
                onError: () => refetch(),
            });
        }
    }, [reorderProjects, refetch]);

    const dragSourceIdRef = useRef<string | null>(null);

    const getClientOrCastName = (project: any): string => {
        const clientName =
            project?.client?.name ||
            project?.client?.fullName ||
            project?.client?.personal?.fullName ||
            project?.client?.business?.name;

        if (clientName) return clientName;

        const cast = project?.cast;
        if (Array.isArray(cast)) {
            const names = cast
                .map((member: any) => {
                    if (!member) return null;
                    if (typeof member === 'string') {
                        const found = projectCast.find((pc: any) => (pc._id || pc.id) === member || pc.name === member);
                        return found?.name || member;
                    }

                    if (member.castId) {
                        const castEntry = member.castId;
                        if (typeof castEntry === 'string') {
                            const found = projectCast.find((pc: any) => (pc._id || pc.id) === castEntry || pc.name === castEntry);
                            return found?.name || castEntry;
                        }
                        if (typeof castEntry === 'object') {
                            const found = projectCast.find((pc: any) => (pc._id || pc.id) === (castEntry._id || castEntry.id) || pc.name === castEntry.name);
                            return castEntry.name || found?.name || '';
                        }
                    }

                    if (typeof member === 'object') {
                        return (
                            member?.name ||
                            member?.fullName ||
                            member?.client?.name ||
                            member?.client?.personal?.fullName ||
                            member?.client?.business?.name ||
                            null
                        );
                    }

                    return null;
                })
                .filter(Boolean) as string[];

            if (names.length === 0) return "-";
            if (names.length <= 2) return names.join(", ");
            return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
        }

        if (cast && typeof cast === "object") {
            if (typeof cast === 'string') return cast;
            const found = projectCast.find((pc: any) => (pc._id || pc.id) === (cast._id || cast.id) || pc.name === cast.name);
            return cast?.name || cast?.fullName || found?.name || "-";
        }

        return "-";
    };

    return (
        <div className="space-y-8 pb-10 px-4 sm:px-6 lg:px-8">
            <section className="card rounded-3xl relative overflow-hidden p-6 sm:p-8">
                <div className="absolute -top-20 -right-14 h-56 w-56 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-secdark-700/20 blur-3xl dark:bg-secdark-700/20" />

                <div className="relative flex flex-col gap-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                                {tr("projects_label", "Project Library")}
                            </span>
                            <h1 className="title mt-3 text-2xl sm:text-3xl lg:text-4xl text-light-900 dark:text-dark-50">{tr("projects_title", "Projects")}</h1>
                            <p className="text-light-600 dark:text-dark-300 mt-1 text-sm sm:text-base">{tr("projects_subtitle", "Manage your projects and sub-projects.")}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => refetch()} className="btn-ghost flex items-center gap-2" title={tr("refresh", "Refresh")}>
                                <RefreshCw size={16} />
                            </button>
                            <button type="button" onClick={() => navigate("/projects/add")} className="btn-primary flex items-center gap-2">
                                <Plus size={16} />
                                <span>{tr("add_project", "Add Project")}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="card p-4">
                            <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_projects", "Total Projects")}</p>
                            <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{total}</p>
                        </div>
                        <div className="card p-4">
                            <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("published", "Published")}</p>
                            <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{published}</p>
                        </div>
                        <div className="card p-4">
                            <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("drafts", "Drafts")}</p>
                            <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{drafts}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card rounded-2xl p-6">
                <div className="flex flex-col gap-3">
                    <div className="relative max-w-md">
                        <Search className="text-light-600 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={tr("search_projects", "Search projects...")}
                            className="input w-full rounded-xl pr-3 pl-10"
                        />
                    </div>
                    {usedProjectCompanies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCompanyFilter([])}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                    companyFilter.length === 0
                                        ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                        : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:border-dark-500 dark:hover:bg-dark-700"
                                }`}
                            >
                                {tr("all", "All")}
                                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                    {projects.length}
                                </span>
                            </button>
                            {usedProjectCompanies.map((pc: any) => {
                                const cid = pc._id || pc.id;
                                const selected = companyFilter.includes(cid);
                                const count = projects.filter((p: any) => {
                                    const c = (p as any).company;
                                    const pid = typeof c === "string" ? c : c?._id || c?.id || "";
                                    return pid === cid;
                                }).length;
                                return (
                                    <button
                                        key={cid}
                                        type="button"
                                        onClick={() => toggleCompanyFilter(cid)}
                                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                            selected
                                                ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                                : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:border-dark-500 dark:hover:bg-dark-700"
                                        }`}
                                    >
                                        {localizedText(pc.name) || cid}
                                        <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                                            selected
                                                ? "bg-white/20 text-white"
                                                : "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="border-light-500 border-t-light-500 dark:border-light-500 dark:border-t-light-500 h-12 w-12 animate-spin rounded-full border-4" />
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {(error as any)?.message || tr("failed_projects", "Failed to load projects")}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                    <p className="text-light-600 dark:text-dark-400">{projects.length === 0 ? tr("no_projects_yet", "No projects yet") : tr("no_projects_found", "No projects found")}</p>
                    <button onClick={() => navigate("/projects/add")} className="btn-primary mt-4 inline-flex items-center gap-2">
                        <Plus size={16} />
                        {tr("add_project", "Add Project")}
                    </button>
                </div>
            ) : (
                <DndProvider backend={HTML5Backend}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((project: any) => (
                        <SortableProjectCard
                            key={getProjectId(project)}
                            project={project}
                            dragIdRef={dragSourceIdRef}
                            onMove={handleMove}
                            onDragStart={handleDragStart}
                            onDrop={handleDrop}
                        >
                            <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                                <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br blur-3xl from-secdark-300/20 to-secdark-700/10" />

                                {(project.mainCover?.croppedUrl || project.mainCover?.url) ? (
                                    <div className="relative z-10 mb-4 -mx-6 -mt-6 overflow-hidden aspect-[4/5]">
                                        <img
                                            src={project.mainCover.croppedUrl || project.mainCover.url}
                                            alt={localizedText(project.localizedName || project.name)}
                                            className="w-full h-full object-cover object-center"
                                        />
                                        <div className="absolute top-3 right-3">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={!!project.published}
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTogglePublish(project); }}
                                                title={project.published ? tr("unpublish", "Unpublish") : tr("publish", "Publish")}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full shadow-lg transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-900 ${
                                                    project.published
                                                        ? "bg-danger-500"
                                                        : "bg-black/40 hover:bg-black/60"
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                        project.published ? "translate-x-5.5" : "translate-x-0.5"
                                                    } mt-0.5`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative z-10 mb-4 -mx-6 -mt-6 flex items-center justify-center h-24 bg-light-100 dark:bg-dark-800">
                                        <div className="absolute top-3 right-3">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={!!project.published}
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTogglePublish(project); }}
                                                title={project.published ? tr("unpublish", "Unpublish") : tr("publish", "Publish")}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full shadow-lg transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-900 ${
                                                    project.published
                                                        ? "bg-danger-500"
                                                        : "bg-light-300 dark:bg-dark-600"
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                        project.published ? "translate-x-5.5" : "translate-x-0.5"
                                                    } mt-0.5`}
                                                />
                                            </button>
                                        </div>
                                        <ImageIcon size={32} className="text-light-300 dark:text-dark-600" />
                                    </div>
                                )}

                                <div className="relative z-10 mb-4 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <GripVertical size={16} className="text-light-400 dark:text-dark-500 shrink-0" />
                                        <h3 className="text-lg font-extrabold text-light-900 dark:text-dark-50 truncate">{localizedText(project.localizedName || project.name) || tr("untitled", "Untitled")}</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(project)}
                                        disabled={deletingId === getProjectId(project)}
                                        title={tr("delete", "Delete")}
                                        aria-label={`${tr("delete_confirm", "Delete")} ${localizedText(project.localizedName || project.name) || tr("project", "project")}`}
                                        className="p-1.5 rounded-lg text-light-400 dark:text-dark-500 hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        {deletingId === getProjectId(project) ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={15} />
                                        )}
                                    </button>
                                </div>

                                <div className="relative z-10 mb-4 flex-1">
                                    <p className="text-sm text-light-600 dark:text-dark-400 line-clamp-2">{localizedText(project.localizedDescription || project.description) || "-"}</p>
                                    <div className="text-xs text-light-500 dark:text-dark-500 mt-3">{tr("cast_client", "Cast/Client: ")}{getClientOrCastName(project)}</div>
                                </div>

                                <div className="relative z-10 mt-auto flex gap-2">
                                    <Link to={`/projects/${project.id}`} className="btn-secondary flex min-w-0 flex-1 items-center justify-center gap-2 text-sm">{tr("view", "View")}</Link>
                                    <Link to={`/projects/${project.id}/edit`} className="btn-primary flex min-w-0 flex-1 items-center justify-center gap-2 text-sm">{tr("edit", "Edit")}</Link>
                                </div>
                            </div>
                        </SortableProjectCard>
                    ))}
                </div>
            </DndProvider>
            )}
        </div>
    );
};

export default ProjectsPage;
