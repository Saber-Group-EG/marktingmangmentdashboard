import React, { useState, useMemo } from "react";
import { X, Search, CheckCircle, Circle, Layers, Image as ImageIcon, Video, FileText, Code, Copy, Loader2 } from "lucide-react";
import { useProject, useProjectsPaginated } from "@/hooks/queries";
import { getProxiedCoverUrl } from "@/utils/proxy";

interface SourceMaterial {
    _id?: string;
    type?: string;
    order?: number;
    caption?: any;
    description?: any;
    url?: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    thumbnail?: string | { url: string; mimeType?: string; size?: number; originalName?: string };
    items?: { url?: string; mimeType?: string; size?: number; originalName?: string; thumbnail?: string; type?: string; caption?: any }[];
    textContent?: any;
    htmlContent?: any;
    before?: { url?: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
    after?: { url?: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
}

interface TargetMaterial {
    _id?: string;
    type: "photo" | "bulk" | "video" | "before_after" | "text" | "html";
    order: number;
    caption?: any;
    description?: any;
    url?: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    thumbnail?: string | { url: string; mimeType?: string; size?: number; originalName?: string };
    items?: any[];
    textContent?: any;
    htmlContent?: any;
    before?: { url: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
    after?: { url: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
}

type ImportMaterialsModalProps = {
    open: boolean;
    onClose: () => void;
    onImport: (materials: TargetMaterial[]) => void;
    localizedToString: (value: any) => string;
    currentProjectId?: string;
};

const MaterialThumbnail: React.FC<{ material: SourceMaterial; size?: number }> = ({ material, size = 64 }) => {
    const px = `${size}px`;

    const getItemSrc = (item: any): { src: string; isVideo: boolean } => {
        const thumb = typeof item.thumbnail === "string" ? item.thumbnail : item.thumbnail?.url;
        if (thumb) return { src: getProxiedCoverUrl(thumb, { width: 100, quality: 50 }), isVideo: false };
        if (item.url) {
            const isVid = (item.mimeType || "").startsWith("video/");
            return { src: isVid ? item.url : getProxiedCoverUrl(item.url, { width: 100, quality: 50 }), isVideo: isVid };
        }
        return { src: "", isVideo: false };
    };

    if (material.type === "bulk" && material.items && material.items.length > 0) {
        const previewItems = material.items.slice(0, 4);
        return (
            <div style={{ width: px, height: px }} className="relative grid grid-cols-2 gap-0.5 rounded overflow-hidden shrink-0">
                {previewItems.map((item: any, idx: number) => {
                    const { src, isVideo } = getItemSrc(item);
                    return (
                        <div key={idx} className="relative bg-dark-700 overflow-hidden">
                            {src ? (
                                isVideo ? (
                                    <video src={src} className="w-full h-full object-cover" muted preload="metadata" />
                                ) : (
                                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-3 h-3 text-dark-500" />
                                </div>
                            )}
                        </div>
                    );
                })}
                {material.items.length > 4 && (
                    <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 rounded-tl">
                        +{material.items.length - 4}
                    </div>
                )}
            </div>
        );
    }

    if (material.type === "video") {
        const thumbUrl = typeof material.thumbnail === "string" ? material.thumbnail : material.thumbnail?.url;
        if (thumbUrl) {
            return <img src={getProxiedCoverUrl(thumbUrl, { width: 100, quality: 50 })} alt={material.originalName || "Video"} style={{ width: px, height: px }} className="object-cover rounded shrink-0" />;
        }
        if (material.url) {
            return <video src={material.url} style={{ width: px, height: px }} className="object-cover rounded shrink-0" muted preload="metadata" />;
        }
        if (material.items && material.items.length > 0) {
            const firstItem = material.items[0];
            const { src, isVideo } = getItemSrc(firstItem);
            if (src) {
                return isVideo
                    ? <video src={src} style={{ width: px, height: px }} className="object-cover rounded shrink-0" muted preload="metadata" />
                    : <img src={src} alt={firstItem.originalName || "Video"} style={{ width: px, height: px }} className="object-cover rounded shrink-0" />;
            }
        }
        return <div style={{ width: px, height: px }} className="flex items-center justify-center bg-dark-700 rounded shrink-0"><Video className="w-5 h-5 text-dark-400" /></div>;
    }
    if (material.type === "text") {
        return <div style={{ width: px, height: px }} className="flex items-center justify-center bg-dark-700 rounded shrink-0"><FileText className="w-5 h-5 text-dark-400" /></div>;
    }
    if (material.type === "html") {
        return <div style={{ width: px, height: px }} className="flex items-center justify-center bg-dark-700 rounded shrink-0"><Code className="w-5 h-5 text-dark-400" /></div>;
    }
    if (material.type === "before_after") {
        const beforeUrl = material.before?.url;
        return beforeUrl
            ? <img src={getProxiedCoverUrl(beforeUrl, { width: 100, quality: 50 })} alt="Before" style={{ width: px, height: px }} className="object-cover rounded shrink-0" />
            : <div style={{ width: px, height: px }} className="flex items-center justify-center bg-dark-700 rounded shrink-0"><Copy className="w-5 h-5 text-dark-400" /></div>;
    }
    if (material.url) {
        return <img src={getProxiedCoverUrl(material.url, { width: 100, quality: 50 })} alt={material.originalName || "Photo"} style={{ width: px, height: px }} className="object-cover rounded shrink-0" />;
    }
    if (material.items && material.items.length > 0) {
        const firstItem = material.items[0];
        if (firstItem?.url) {
            return <img src={getProxiedCoverUrl(firstItem.url, { width: 100, quality: 50 })} alt={firstItem.originalName || "Photo"} style={{ width: px, height: px }} className="object-cover rounded shrink-0" />;
        }
    }
    return <div style={{ width: px, height: px }} className="flex items-center justify-center bg-dark-700 rounded shrink-0"><ImageIcon className="w-5 h-5 text-dark-400" /></div>;
};

const ImportMaterialsModal: React.FC<ImportMaterialsModalProps> = ({ open, onClose, onImport, localizedToString, currentProjectId }) => {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedMaterialIndices, setSelectedMaterialIndices] = useState<Set<number>>(new Set());
    const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());

    React.useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const { data: projectsData, isLoading: isLoadingProjects } = useProjectsPaginated(
        { PageCount: "all", ...(debouncedSearch ? { search: debouncedSearch } : {}) },
        { enabled: open }
    );

    const projects = useMemo(() => {
        const list = projectsData?.data || [];
        return list
            .filter((p: any) => (p._id || p.id) !== currentProjectId)
            .sort((a: any, b: any) => {
                const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return da - db;
            });
    }, [projectsData, currentProjectId]);

    const { data: sourceProject, isLoading: isLoadingSource } = useProject(selectedProjectId || undefined, { enabled: !!selectedProjectId && open });

    const sourceMaterials = useMemo(() => {
        if (!sourceProject) return [];
        return (sourceProject as any).material || [];
    }, [sourceProject]);

    const toggleMaterial = (index: number) => {
        setSelectedMaterialIndices((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
                const mat = sourceMaterials[index];
                if (mat?.items) {
                    mat.items.forEach((_: any, itemIdx: number) => {
                        setSelectedItemKeys((prevKeys) => {
                            const nk = new Set(prevKeys);
                            nk.delete(`${index}-${itemIdx}`);
                            return nk;
                        });
                    });
                }
            } else {
                next.add(index);
                const mat = sourceMaterials[index];
                if (mat?.items) {
                    mat.items.forEach((_: any, itemIdx: number) => {
                        setSelectedItemKeys((prevKeys) => {
                            const nk = new Set(prevKeys);
                            nk.add(`${index}-${itemIdx}`);
                            return nk;
                        });
                    });
                }
            }
            return next;
        });
    };

    const toggleItem = (matIndex: number, itemIndex: number) => {
        const key = `${matIndex}-${itemIndex}`;
        setSelectedItemKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAllMaterials = () => {
        if (selectedMaterialIndices.size === sourceMaterials.length) {
            setSelectedMaterialIndices(new Set());
            setSelectedItemKeys(new Set());
        } else {
            const all = new Set<number>();
            const allItems = new Set<string>();
            sourceMaterials.forEach((mat: any, idx: number) => {
                all.add(idx);
                if (mat?.items) {
                    mat.items.forEach((_: any, itemIdx: number) => {
                        allItems.add(`${idx}-${itemIdx}`);
                    });
                }
            });
            setSelectedMaterialIndices(all);
            setSelectedItemKeys(allItems);
        }
    };

    const deepCloneMaterial = (mat: SourceMaterial, order: number): TargetMaterial => {
        const clone: TargetMaterial = {
            type: (mat.type as any) || "photo",
            order,
        };
        if (mat.url) clone.url = mat.url;
        if (mat.mimeType) clone.mimeType = mat.mimeType;
        if (mat.size) clone.size = mat.size;
        if (mat.originalName) clone.originalName = mat.originalName;
        if (mat.caption) clone.caption = typeof mat.caption === "object" ? { ...mat.caption } : mat.caption;
        if (mat.description) clone.description = typeof mat.description === "object" ? { ...mat.description } : mat.description;
        if (mat.textContent) clone.textContent = typeof mat.textContent === "object" ? { ...mat.textContent } : mat.textContent;
        if (mat.htmlContent) clone.htmlContent = typeof mat.htmlContent === "object" ? { ...mat.htmlContent } : mat.htmlContent;
        if (mat.thumbnail) {
            clone.thumbnail = typeof mat.thumbnail === "object" ? { ...mat.thumbnail } : mat.thumbnail;
        }
        if (mat.before) {
            const b: any = { ...mat.before };
            if (mat.before.label && typeof mat.before.label === "object") {
                b.label = { ...mat.before.label };
            }
            clone.before = b;
        }
        if (mat.after) {
            const a: any = { ...mat.after };
            if (mat.after.label && typeof mat.after.label === "object") {
                a.label = { ...mat.after.label };
            }
            clone.after = a;
        }
        if (Array.isArray(mat.items) && mat.items.length > 0) {
            clone.items = mat.items.map((item) => ({
                url: item.url,
                mimeType: item.mimeType,
                size: item.size,
                originalName: item.originalName,
                thumbnail: item.thumbnail,
                type: item.type,
                caption: item.caption ? (typeof item.caption === "object" ? { ...item.caption } : item.caption) : undefined,
            }));
        }
        return clone;
    };

    const handleImport = () => {
        const imported: TargetMaterial[] = [];
        let order = 1;

        sourceMaterials.forEach((mat: SourceMaterial, matIdx: number) => {
            if (selectedMaterialIndices.has(matIdx)) {
                const matItemKeys = Array.from(selectedItemKeys).filter((k) => k.startsWith(`${matIdx}-`));

                if (matItemKeys.length > 0 && mat.items && mat.items.length > 0) {
                    const selectedIndices = matItemKeys
                        .map((k) => parseInt(k.split("-")[1]))
                        .sort((a, b) => a - b);

                    const clonedItems = selectedIndices
                        .map((itemIdx) => mat.items![itemIdx])
                        .filter(Boolean)
                        .map((item: any) => {
                            const { _id: _, ...rest } = item;
                            return {
                                url: rest.url,
                                mimeType: rest.mimeType,
                                size: rest.size,
                                originalName: rest.originalName,
                                thumbnail: rest.thumbnail,
                                type: rest.type,
                                caption: rest.caption ? (typeof rest.caption === "object" ? { ...rest.caption } : rest.caption) : undefined,
                            };
                        });

                    const primaryItem = clonedItems[0];
                    const material = {
                        ...deepCloneMaterial(mat, order),
                        items: clonedItems,
                        url: primaryItem?.url || mat.url || "",
                        mimeType: primaryItem?.mimeType || mat.mimeType,
                        originalName: primaryItem?.originalName || mat.originalName,
                        size: primaryItem?.size || mat.size,
                        order,
                    };
                    delete (material as any)._id;
                    imported.push(material);
                } else {
                    const material = deepCloneMaterial(mat, order);
                    delete (material as any)._id;
                    imported.push(material);
                }
                order++;
            }
        });

        onImport(imported);
        setSelectedMaterialIndices(new Set());
        setSelectedItemKeys(new Set());
        setSelectedProjectId(null);
        setSearch("");
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-dark-900 rounded-xl sm:rounded-2xl shadow-2xl w-full h-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-light-200 dark:border-dark-700 shrink-0">
                    <h3 className="text-base sm:text-lg font-semibold text-light-900 dark:text-dark-50">Import from Other Project</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-light-100 dark:hover:bg-dark-700 text-light-500 dark:text-dark-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {!selectedProjectId ? (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500" />
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-light-50 dark:bg-dark-800 border border-light-200 dark:border-dark-700 rounded-lg text-sm text-light-900 dark:text-dark-50 placeholder:text-light-400 dark:placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                                {isLoadingProjects ? (
                                    <div className="flex items-center justify-center py-8 text-light-500 dark:text-dark-400">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Loading projects...
                                    </div>
                                ) : projects.length === 0 ? (
                                    <div className="text-center py-8 text-light-500 dark:text-dark-400 text-sm">
                                        {search ? "No projects found" : "Start typing to search projects"}
                                    </div>
                                ) : (
                                    projects.map((project: any, pIdx: number) => {
                                        const pId = project._id || project.id;
                                        const pName = localizedToString(project.localizedName || project.name);
                                        const matCount = (project.material || []).length;
                                        return (
                                            <button
                                                key={pId}
                                                type="button"
                                                onClick={() => { setSelectedProjectId(pId); setSelectedMaterialIndices(new Set()); setSelectedItemKeys(new Set()); }}
                                                className="w-full text-left px-4 py-3 rounded-lg hover:bg-light-100 dark:hover:bg-dark-800 transition-colors border border-light-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-600"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-light-400 dark:text-dark-500 shrink-0 w-6 text-right">#{pIdx + 1}</span>
                                                    <div className="font-medium text-sm text-light-900 dark:text-dark-50 truncate">{pName || "Untitled Project"}</div>
                                                </div>
                                                <div className="text-xs text-light-500 dark:text-dark-400 mt-0.5 ml-8">{matCount} material{matCount !== 1 ? "s" : ""}</div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => { setSelectedProjectId(null); setSelectedMaterialIndices(new Set()); setSelectedItemKeys(new Set()); }}
                                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
                            >
                                ← Change project
                            </button>

                            {isLoadingSource ? (
                                <div className="flex items-center justify-center py-12 text-light-500 dark:text-dark-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Loading materials...
                                </div>
                            ) : sourceMaterials.length === 0 ? (
                                <div className="text-center py-12 text-light-500 dark:text-dark-400 text-sm">
                                    This project has no materials
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={selectAllMaterials}
                                            className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                                        >
                                            {selectedMaterialIndices.size === sourceMaterials.length ? "Deselect All" : "Select All"}
                                        </button>
                                        <span className="text-xs text-light-500 dark:text-dark-400">
                                            {selectedMaterialIndices.size} material{selectedMaterialIndices.size !== 1 ? "s" : ""} selected
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {sourceMaterials.map((mat: SourceMaterial, matIdx: number) => {
                                            const isMatSelected = selectedMaterialIndices.has(matIdx);
                                            const matLabel = localizedToString(mat.caption) || mat.originalName || `Material ${matIdx + 1}`;
                                            const hasItems = Array.isArray(mat.items) && mat.items.length > 0;

                                            return (
                                                <div
                                                    key={mat._id || matIdx}
                                                    className={`border rounded-lg transition-colors ${
                                                        isMatSelected
                                                            ? "border-green-400 dark:border-green-500 bg-green-50/50 dark:bg-green-950/20"
                                                            : "border-light-200 dark:border-dark-700 hover:border-light-300 dark:hover:border-dark-600"
                                                    }`}
                                                >
                                                    <div
                                                        className="flex items-center gap-3 p-3 cursor-pointer"
                                                        onClick={() => toggleMaterial(matIdx)}
                                                    >
                                                        {isMatSelected ? (
                                                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                                                        ) : (
                                                            <Circle className="w-5 h-5 text-light-400 dark:text-dark-500 shrink-0" />
                                                        )}
                                                        <MaterialThumbnail material={mat} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-light-900 dark:text-dark-50 truncate">{matLabel}</div>
                                                            <div className="text-xs text-light-500 dark:text-dark-400 flex items-center gap-1.5">
                                                                <span className="capitalize">{mat.type || "photo"}</span>
                                                                {hasItems && <span>· {mat.items!.length} item{mat.items!.length !== 1 ? "s" : ""}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {hasItems && isMatSelected && (
                                                        <div className="px-3 pb-3 pt-0 ml-8 space-y-1">
                                                            {mat.items!.map((item: any, itemIdx: number) => {
                                                                const itemKey = `${matIdx}-${itemIdx}`;
                                                                const isItemSelected = selectedItemKeys.has(itemKey);
                                                                const itemLabel = item.originalName || `Item ${itemIdx + 1}`;
                                                                const isVideo = (item.mimeType || "").startsWith("video/") || mat.type === "video";
                                                                return (
                                                                    <div
                                                                        key={itemIdx}
                                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                                                                            isItemSelected
                                                                                ? "bg-green-100 dark:bg-green-900/30"
                                                                                : "hover:bg-light-100 dark:hover:bg-dark-800"
                                                                        }`}
                                                                        onClick={(e) => { e.stopPropagation(); toggleItem(matIdx, itemIdx); }}
                                                                    >
                                                                        {isItemSelected ? (
                                                                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                                                        ) : (
                                                                            <Circle className="w-4 h-4 text-light-400 dark:text-dark-500 shrink-0" />
                                                                        )}
                                                                        {item.thumbnail ? (
                                                                            <img src={getProxiedCoverUrl(item.thumbnail, { width: 80, quality: 50 })} alt={itemLabel} className="w-8 h-8 object-cover rounded shrink-0" loading="lazy" />
                                                                        ) : item.url && isVideo ? (
                                                                            <video src={item.url} className="w-8 h-8 object-cover rounded shrink-0" muted preload="metadata" />
                                                                        ) : item.url ? (
                                                                            <img src={getProxiedCoverUrl(item.url, { width: 80, quality: 50 })} alt={itemLabel} className="w-8 h-8 object-cover rounded shrink-0" loading="lazy" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 flex items-center justify-center bg-dark-700 rounded shrink-0">
                                                                                {isVideo ? <Video className="w-3.5 h-3.5 text-dark-400" /> : <ImageIcon className="w-3.5 h-3.5 text-dark-400" />}
                                                                            </div>
                                                                        )}
                                                                        <span className="text-xs text-light-700 dark:text-dark-300 truncate">{itemLabel}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-light-200 dark:border-dark-700 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-light-700 dark:text-dark-300 hover:bg-light-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!selectedProjectId || selectedMaterialIndices.size === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                        <Layers className="w-4 h-4" />
                        Import {selectedMaterialIndices.size > 0 ? `(${selectedMaterialIndices.size})` : ""}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportMaterialsModal;
