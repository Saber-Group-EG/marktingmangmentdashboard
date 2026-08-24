import React, { useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useProject, useProjectCast } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import SocialLinkIcons from "@/components/SocialLinkIcons";
import BilingualText from "@/components/BilingualText";
// framer-motion removed (no animations on this page)
import { 
    ChevronDown, ChevronUp, Play, Maximize2, X, ChevronLeft, ChevronRight,
   MapPin, Users, Tag, Layers, 
    Code, FileText,  Copy, Check, Grid, List,
 User,  FolderTree, Camera,
    Award, Link as LinkIcon, Info,
    Globe
} from "lucide-react";

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const v = t(key);
        return !v || v === key ? fallback : v;
    };


    const localizedToString = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") return value[lang] || value.en || value.ar || "";
        return "";
    };

    const { data: project, isLoading, error } = useProject(id);
    const { data: projectCast = [] } = useProjectCast();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
      "overview", "materials", "cast", "identifiers", 
      "timeline", "categories", "metadata", "raw"
    ]));
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatRichText = (content?: string) => {
        if (!content) return "";
        return /<\/?[a-z][\s\S]*>/i.test(content) ? content : content.replace(/\n/g, "<br />");
    };

    const getOptionLabel = (value: any): string => {
        if (typeof value === "string") return value;
        if (!value || typeof value !== "object") return "";
        if (value[lang]) return String(value[lang]);
        if (value.name && typeof value.name === "object" && value.name[lang]) return String(value.name[lang]);
        return localizedToString(value.name) || localizedToString(value);
    };

    const getOptionKey = (value: any, index: number): string => {
        if (typeof value === "string") return value;
        if (!value || typeof value !== "object") return `item-${index}`;
        return value._id || value.id || value.name || value.title || `item-${index}`;
    };

    const isPhotoMaterialType = (type?: string): boolean => type === "photo" || type === "bulk";

    const buildPhotoItems = (material: any): any[] => {
        const merged: any[] = [];

        if (material?.url) {
            merged.push({
                url: material.url,
                mimeType: material.mimeType,
                originalName: material.originalName,
                size: material.size,
                type: "photo",
            });
        }

        if (Array.isArray(material?.items)) {
            material.items
                .filter((item: any) => !!item?.url)
                .forEach((item: any) => {
                    merged.push({
                        url: item.url,
                        mimeType: item.mimeType || material?.mimeType,
                        originalName: item.originalName,
                        size: item.size,
                        type: "photo",
                    });
                });
        }

        const seen = new Set<string>();
        return merged.filter((item: any) => {
            const key = String(item?.url || "").trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const buildVideoItems = (material: any): any[] => {
        const merged: any[] = [];

        if (material?.url && material?.type === "video") {
            merged.push({
                url: material.url,
                mimeType: material.mimeType,
                originalName: material.originalName,
                size: material.size,
                thumbnail: typeof material.thumbnail === "string" ? material.thumbnail : material.thumbnail?.url,
                type: "video",
            });
        }

        if (Array.isArray(material?.items)) {
            material.items
                .filter((item: any) => !!item?.url)
                .forEach((item: any) => {
                    merged.push({
                        url: item.url,
                        mimeType: item.mimeType || material?.mimeType,
                        originalName: item.originalName,
                        size: item.size,
                        thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : item.thumbnail?.url,
                        type: "video",
                    });
                });
        }

        const seen = new Set<string>();
        return merged.filter((item: any) => {
            const key = String(item?.url || "").trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const isVideoBulkType = (material: any): boolean => {
        if (material?.type !== "bulk") return false;
        const items = buildVideoItems(material);
        return items.length > 0 && (items[0]?.mimeType || "").startsWith("video/");
    };

    const normalizeProjectMaterials = (materials: any[] = []): any[] => {
        const sorted = [...materials].sort((a, b) => (a?.order || 0) - (b?.order || 0));
        return sorted.map((material, index) => {
            if (material?.type === "bulk" && isVideoBulkType(material)) {
                const videoItems = buildVideoItems(material);
                const primary = videoItems[0];
                return {
                    ...material,
                    type: "bulk",
                    items: videoItems,
                    url: primary?.url || material?.url,
                    mimeType: primary?.mimeType || material?.mimeType,
                    originalName: primary?.originalName || material?.originalName,
                    size: primary?.size || material?.size,
                    order: index + 1,
                };
            }

            if (!isPhotoMaterialType(material?.type)) {
                return { ...material, order: index + 1 };
            }

            const photoItems = buildPhotoItems(material);
            const primary = photoItems[0];

            return {
                ...material,
                type: "photo",
                items: photoItems,
                url: primary?.url || material?.url,
                mimeType: primary?.mimeType || material?.mimeType,
                originalName: primary?.originalName || material?.originalName,
                size: primary?.size || material?.size,
                order: index + 1,
            };
        });
    };

   

    // Helpers to avoid exposing raw IDs in the UI
    const isLikelyIdKey = (key: string) => {
        if (!key) return false;
        const k = key.toLowerCase();
        return k === '_id' || k.endsWith('id');
    };

    const sanitize = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(sanitize);
        if (typeof obj === 'object') {
            const out: any = {};
            for (const k in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                if (isLikelyIdKey(k)) out[k] = 'Hidden';
                else out[k] = sanitize(obj[k]);
            }
            return out;
        }
        return obj;
    };

    const shiftSelectedPhoto = (direction: "next" | "prev") => {
        setSelectedMedia((previous: any) => {
            if (!previous || !isPhotoMaterialType(previous.type)) {
                return previous;
            }

            const photoItems = buildPhotoItems(previous);

            if (photoItems.length <= 1) {
                return previous;
            }

            const currentIndex = Number.isFinite(Number(previous.selectedPhotoIndex))
                ? Number(previous.selectedPhotoIndex)
                : 0;
            const delta = direction === "next" ? 1 : -1;
            const nextIndex = (currentIndex + delta + photoItems.length) % photoItems.length;

            return {
                ...previous,
                selectedPhotoIndex: nextIndex,
                selectedPhoto: photoItems[nextIndex],
            };
        });
    };

 

    // derive project helpers and display data unconditionally to keep hooks order stable
    const p: any = project;
    const projectId = id || p?.id || p?._id;

    // Use the original localized objects preserved by transformProject
    const projectName = p?.localizedName || p?.name || "";
    const projectDescription = p?.localizedDescription || p?.description || "";
    const projectLocation = p?.localizedLocation || p?.location || "";

    const groupedMaterials = normalizeProjectMaterials(p?.material || []);

    const displayCast = useMemo(() => {
        const raw = p?.cast || [];
        return (Array.isArray(raw) ? raw : []).map((c: any, idx: number) => {
            if (!c) return { _id: undefined, name: "", title: "", order: idx + 1 };

            // simple string id
            if (typeof c === "string") {
                const found = projectCast.find((pc: any) => (pc._id || pc.id) === c || pc.name === c);
                return {
                    _id: found?._id,
                    name: found?.name || c,
                    title: (found as any)?.title || "",
                    socialLinks: (found as any)?.socialLinks || [],
                    photo: (found as any)?.photo || null,
                    order: idx + 1,
                };
            }

            // New server shape: { castId: <id|object>, order }
            if (c.castId) {
                const castEntry = c.castId;
                if (typeof castEntry === 'string') {
                    const found = projectCast.find((pc: any) => (pc._id || pc.id) === castEntry || pc.name === castEntry);
                    return {
                        _id: found?._id,
                        name: found?.name || castEntry,
                        title: (found as any)?.title || "",
                        socialLinks: (found as any)?.socialLinks || [],
                        photo: (found as any)?.photo || null,
                        order: c.order || idx + 1,
                    };
                }

                if (typeof castEntry === 'object') {
                    const found = projectCast.find((pc: any) => (pc._id || pc.id) === (castEntry._id || castEntry.id) || pc.name === castEntry.name);
                    return {
                        _id: castEntry._id || found?._id,
                        name: castEntry.name || found?.name || "",
                        title: castEntry.title || (found as any)?.title || "",
                        socialLinks: castEntry.socialLinks || (found as any)?.socialLinks || [],
                        photo: castEntry.photo || (found as any)?.photo || null,
                        order: c.order || idx + 1,
                    };
                }
            }

            // legacy object shape
            if (typeof c === "object") {
                if (c.name) {
                    const found = projectCast.find((pc: any) => (pc._id || pc.id) === (c._id || c.id) || pc.name === c.name);
                    return {
                        _id: c._id || found?._id,
                        name: c.name,
                        title: c.title || (found as any)?.title || "",
                        socialLinks: c.socialLinks?.length ? c.socialLinks : (found as any)?.socialLinks || [],
                        photo: c.photo || (found as any)?.photo || null,
                        order: c.order || idx + 1,
                    };
                }

                const found = projectCast.find((pc: any) => pc._id === c._id || pc.id === c._id || pc._id === c.id || pc.name === c.name);
                return { ...(found || {}), ...c, order: c.order || idx + 1 };
            }

            return { name: String(c), title: "", order: idx + 1 };
        });
    }, [p?.cast, projectCast]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-light-50 dark:bg-dark-950 flex items-center justify-center">
                <div className="text-center">
                   
                    <p className="text-light-600 dark:text-dark-400 font-light tracking-wide">{tr("loading_projects", "Loading Projects")}</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-light-50 dark:bg-dark-900 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-6">
                    <div className="w-24 h-24 mx-auto mb-6 bg-danger-50 dark:bg-danger-950/30 rounded-full flex items-center justify-center">
                        <X className="w-12 h-12 text-danger-500 dark:text-danger-400" />
                    </div>
                    <h2 className="text-2xl font-light mb-2 text-light-900 dark:text-dark-50">{tr("project_not_found", "Project Not Found")}</h2>
                    <p className="text-light-600 dark:text-dark-400 mb-6">{(error as any)?.message || tr("project_not_found_msg", "The requested project doesn't exist or has been removed.")}</p>
                    <Link to="/projects" className="btn-primary inline-flex">
                        {tr("browse_all_projects", "Browse All Projects")}
                    </Link>
                </div>
            </div>
        );
    }

    /* `p`, `groupedMaterials`, and `displayCast` moved earlier to keep hooks order stable */

    const DetailRow = ({ label, value, icon: Icon, copyable = false, copyId = "", bilingual = false }: any) => {
        const formatValue = (v: any) => {
            if (v === null || v === undefined || v === "") return "—";
            if (typeof v === "object") {
                if (Array.isArray(v)) return v.join(", ");
                if (v.en || v.ar) return v[lang] || v.en || v.ar || "";
                return v.fullName ?? v.name ?? 'Hidden';
            }
            return String(v);
        };

        const copyValue = (v: any) => {
            if (v === null || v === undefined) return "";
            if (typeof v === "object") {
                return v.fullName ?? v.name ?? "";
            }
            return String(v);
        };

        const display = formatValue(value);
        const toCopy = copyValue(value);

        return (
            <div className="flex items-start justify-between py-2 border-b border-light-100 dark:border-dark-800 last:border-0">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-light-400 dark:text-dark-500" />}
                    <span className="text-sm font-medium text-light-600 dark:text-dark-400">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    {bilingual && (value?.en || value?.ar) ? (
                        <BilingualText value={value} size="sm" className="text-right" />
                    ) : (
                        <span className="text-sm text-light-900 dark:text-dark-50 break-all text-right">{display}</span>
                    )}
                    {copyable && toCopy && (
                        <button
                            onClick={() => copyToClipboard(toCopy, copyId)}
                            className="p-1 hover:bg-light-100 dark:hover:bg-dark-800 rounded transition-colors"
                        >
                            {copied === copyId ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3 text-light-400 dark:text-dark-500" />}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const Section = ({ id, title, icon: Icon, children }: any) => (
        <div className="mb-8 card p-0 overflow-hidden">
            <button
                onClick={() => toggleSection(id)}
                className="w-full flex items-center justify-between p-5 hover:bg-light-50 dark:hover:bg-dark-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-light-500 dark:text-secdark-500" />}
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{title}</h2>
                    <span className="text-xs text-light-400 dark:text-dark-500 font-mono">{id}</span>
                </div>
                {expandedSections.has(id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.has(id) && (
                <div className="border-t border-light-200 dark:border-dark-800 p-5">
                    {children}
                </div>
            )}
        </div>
    );

    const renderMaterialItem = (m: any, idx: number) => {
        if (!m) return null;
        const key = m._id || m.id || idx;
        const caption = localizedToString(m.caption) || localizedToString(m.textContent) || localizedToString(m.label) || "";

        const MediaCard = ({ children, onClick, className = "" }: any) => (
            <div
                className={`group relative bg-white dark:bg-dark-800 rounded-xl overflow-hidden border border-light-200 dark:border-dark-700 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${className}`}
                onClick={onClick}
            >
                {children}
            </div>
        );

        switch (m.type) {
            case "photo":
                {
                    const photoItems = buildPhotoItems(m);
                    const primaryPhoto = photoItems[0];
                    const isGroupedPhoto = photoItems.length > 1;

                return (
                    <MediaCard
                        key={key}
                        onClick={() =>
                            setSelectedMedia({
                                ...m,
                                selectedPhoto: primaryPhoto || null,
                                selectedPhotoIndex: 0,
                            })
                        }
                        className={isGroupedPhoto ? "sm:col-span-2 lg:col-span-3" : ""}
                    >
                        <div className={`relative overflow-hidden ${isGroupedPhoto ? "" : "aspect-square"}`}>
                            {isGroupedPhoto ? (
                                <div className="w-full bg-black/5 dark:bg-black/20 p-2">
                                    <div className="flex flex-wrap gap-1.5 justify-start">
                                        {photoItems.map((item: any, photoIdx: number) => (
                                        <div
                                            key={`grouped-photo-${item.originalName || "photo"}-${photoIdx}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedMedia({
                                                    ...m,
                                                    selectedPhoto: item,
                                                    selectedPhotoIndex: photoIdx,
                                                });
                                            }}
                                            className="relative w-[90px] sm:w-[110px] md:w-[130px] lg:w-[150px] max-w-[150px] max-h-[150px] aspect-square overflow-hidden rounded-sm cursor-zoom-in flex-none"
                                        >
                                            <img
                                                src={item.url}
                                                alt={caption || `Photo ${photoIdx + 1}`}
                                                className="w-full h-full object-contain bg-black/30 group-hover:scale-105 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                            <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                {photoIdx + 1}
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            ) : primaryPhoto?.url ? (
                                <img src={primaryPhoto.url} alt={caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-light-100 dark:bg-dark-800 text-light-400 dark:text-dark-500">
                                    <Camera className="w-10 h-10 opacity-40" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-xs text-white">
                                {photoItems.length > 1 ? `${photoItems.length} Photos` : `Photo #${m.order}`}
                            </div>
                        </div>
                        <div className="p-3 space-y-2">
                            {caption && <p className="text-sm text-light-600 dark:text-dark-400 line-clamp-2"><BilingualText value={m.caption} size="sm" /></p>}
                            {localizedToString(m.description) && (
                                <p className="text-xs text-light-400 dark:text-dark-500"><BilingualText value={m.description} size="sm" /></p>
                            )}
                            <div className="text-xs text-light-400 dark:text-dark-500 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span>{photoItems.length > 1 ? `${photoItems.length} grouped photos` : (primaryPhoto?.mimeType || m.mimeType || "image")}</span>
                                </div>
                              
                                
                            </div>
                        </div>
                    </MediaCard>
                );
                }

            case "video":
                return (
                    <MediaCard key={key} onClick={() => setSelectedMedia(m)}>
                        <div className="relative aspect-square overflow-hidden bg-black">
                            <video
                                ref={el => { if (el) videoRefs.current[key] = el; }}
                                src={m.url}
                                className="w-full h-full object-cover"
                                poster={m.thumbnail}
                                preload="metadata"
                                muted
                                playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                                    <Play className="w-6 h-6 text-black ml-0.5" />
                                </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-xs text-white">
                                Video #{m.order}
                            </div>
                        </div>
                        <div className="p-3 space-y-2">
                            {caption && <p className="text-sm text-light-600 dark:text-dark-400"><BilingualText value={m.caption} size="sm" /></p>}
                            {localizedToString(m.description) && (
                                <p className="text-xs text-light-400 dark:text-dark-500"><BilingualText value={m.description} size="sm" /></p>
                            )}
                            <div className="text-xs text-light-400 dark:text-dark-500 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span>{m.mimeType || "video"}</span>
                                </div>
                               
                            </div>
                        </div>
                    </MediaCard>
                );

            case "bulk": {
                const isVidBulk = isVideoBulkType(m);
                const bulkItems = isVidBulk ? buildVideoItems(m) : buildPhotoItems(m);
                const isGrouped = bulkItems.length > 1;

                return (
                    <MediaCard
                        key={key}
                        onClick={() =>
                            setSelectedMedia({
                                ...m,
                                selectedPhoto: bulkItems[0] || null,
                                selectedPhotoIndex: 0,
                            })
                        }
                        className={isGrouped ? "sm:col-span-2 lg:col-span-3" : ""}
                    >
                        <div className={`relative overflow-hidden ${isGrouped ? "" : "aspect-square"}`}>
                            {isGrouped ? (
                                <div className="w-full bg-black/5 dark:bg-black/20 p-2">
                                    <div className="flex flex-wrap gap-1.5 justify-start">
                                        {bulkItems.map((item: any, itemIdx: number) => (
                                            <div
                                                key={`bulk-item-${item.originalName || itemIdx}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedMedia({
                                                        ...m,
                                                        selectedPhoto: item,
                                                        selectedPhotoIndex: itemIdx,
                                                    });
                                                }}
                                                className="relative w-[90px] sm:w-[110px] md:w-[130px] lg:w-[150px] max-w-[150px] max-h-[150px] aspect-square overflow-hidden rounded-sm cursor-zoom-in flex-none"
                                            >
                                                {isVidBulk ? (
                                                    item.thumbnail ? (
                                                        <img src={item.thumbnail} alt={item.originalName || `Video ${itemIdx + 1}`} className="w-full h-full object-contain bg-black/30 group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                                    ) : (
                                                        <video src={item.url} className="w-full h-full object-contain bg-black/30" muted preload="metadata" />
                                                    )
                                                ) : (
                                                    <img src={item.url} alt={caption || `Photo ${itemIdx + 1}`} className="w-full h-full object-contain bg-black/30 group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                                )}
                                                <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                    {itemIdx + 1}
                                                </div>
                                                {isVidBulk && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                                        <Play className="w-8 h-8 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : bulkItems[0]?.url ? (
                                isVidBulk ? (
                                    <video src={bulkItems[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted preload="metadata" />
                                ) : (
                                    <img src={bulkItems[0].url} alt={caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-light-100 dark:bg-dark-800 text-light-400 dark:text-dark-500">
                                    <Camera className="w-10 h-10 opacity-40" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-xs text-white">
                                {bulkItems.length > 1 ? `${bulkItems.length} ${isVidBulk ? "Videos" : "Photos"}` : `${isVidBulk ? "Video" : "Photo"} #${m.order}`}
                            </div>
                        </div>
                        <div className="p-3 space-y-2">
                            {caption && <p className="text-sm text-light-600 dark:text-dark-400 line-clamp-2"><BilingualText value={m.caption} size="sm" /></p>}
                            <div className="text-xs text-light-400 dark:text-dark-500 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span>{bulkItems.length > 1 ? `${bulkItems.length} grouped ${isVidBulk ? "videos" : "photos"}` : (bulkItems[0]?.mimeType || m.mimeType || (isVidBulk ? "video" : "image"))}</span>
                                </div>
                            </div>
                        </div>
                    </MediaCard>
                );
            }

            case "before_after":
                return (
                    <MediaCard key={key}>
                        <BeforeAfterSlider
                            beforeUrl={m.before?.url}
                            afterUrl={m.after?.url}
                            beforeLabel={localizedToString(m.before?.label) || tr("before_label", "Before")}
                            afterLabel={localizedToString(m.after?.label) || tr("after_label", "After")}
                            mediaClassName="aspect-square w-full"
                            showSlider={false}
                        />
                        <div className="p-3">
                            {caption && <p className="text-sm text-light-600 dark:text-dark-400 mb-2"><BilingualText value={m.caption} size="sm" /></p>}
                            {localizedToString(m.description) && (
                                <p className="text-xs text-light-400 dark:text-dark-500 mb-2"><BilingualText value={m.description} size="sm" /></p>
                            )}
                            <div className="text-xs text-light-400 dark:text-dark-500 space-y-1">
                                <div>{tr("order_label", "Order:")} {m.order}</div>
                                <div className="flex flex-wrap gap-3">
                                    <div>
                                        <span className="text-light-500 dark:text-dark-400">{tr("before_label", "Before")}:</span>{" "}
                                        <BilingualText value={m.before?.label} size="sm" />
                                    </div>
                                    <div>
                                        <span className="text-light-500 dark:text-dark-400">{tr("after_label", "After")}:</span>{" "}
                                        <BilingualText value={m.after?.label} size="sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </MediaCard>
                );

            case "text":
                return (
                    <div
                        key={key}
                        className="bg-light-50 dark:bg-dark-800/50 rounded-xl p-4 border border-light-200 dark:border-dark-700"
                    >
                        <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-light-500 dark:text-secdark-500 mt-0.5" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    {caption && <p className="text-xs text-light-500 dark:text-secdark-400 font-medium"><BilingualText value={m.caption} size="sm" /></p>}
                                    <span className="text-xs text-light-400 dark:text-dark-500">Text #{m.order}</span>
                                </div>
                                {localizedToString(m.description) && (
                                    <p className="text-xs text-light-400 dark:text-dark-500 mb-2"><BilingualText value={m.description} size="sm" /></p>
                                )}
                                <div className="text-light-700 dark:text-dark-300 space-y-3">
                                    {m.textContent?.en && (
                                        <div>
                                            <span className="text-[10px] font-medium text-light-400 dark:text-dark-500 uppercase tracking-wider">EN</span>
                                            <div dangerouslySetInnerHTML={{ __html: formatRichText(m.textContent.en) }} />
                                        </div>
                                    )}
                                    {m.textContent?.ar && (
                                        <div dir="rtl" className="text-right">
                                            <span className="text-[10px] font-medium text-light-400 dark:text-dark-500 uppercase tracking-wider">AR</span>
                                            <div dangerouslySetInnerHTML={{ __html: formatRichText(m.textContent.ar) }} />
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 pt-2 border-t border-light-200 dark:border-dark-700 text-xs text-light-400 dark:text-dark-500">
                                    {/* ID removed for privacy */}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "html":
                return (
                    <div
                        key={key}
                        className="bg-light-50 dark:bg-dark-800/50 rounded-xl p-4 border border-light-200 dark:border-dark-700"
                    >
                        <div className="flex items-start gap-3">
                            <Code className="w-5 h-5 text-light-500 dark:text-secdark-500 mt-0.5" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    {caption && <p className="text-xs text-light-500 dark:text-secdark-400 font-medium"><BilingualText value={m.caption} size="sm" /></p>}
                                    <span className="text-xs text-light-400 dark:text-dark-500">HTML #{m.order}</span>
                                </div>
                                {localizedToString(m.description) && (
                                    <p className="text-xs text-light-400 dark:text-dark-500 mb-2"><BilingualText value={m.description} size="sm" /></p>
                                )}
                                <div className="prose prose-sm max-w-none text-light-700 dark:text-dark-300" dangerouslySetInnerHTML={{ __html: localizedToString(m.htmlContent) }} />
                                <div className="mt-2 pt-2 border-t border-light-200 dark:border-dark-700 text-xs text-light-400 dark:text-dark-500">
                                    {/* ID removed for privacy */}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div
                        key={key}
                        className="bg-light-50 dark:bg-dark-800/50 rounded-xl p-4 border border-light-200 dark:border-dark-700"
                    >
                        <div className="text-xs text-light-500 dark:text-secdark-400 mb-2">Unknown Type: {m.type}</div>
                            <pre className="text-xs overflow-auto text-light-700 dark:text-dark-300">{JSON.stringify(sanitize(m), null, 2)}</pre>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-light-50 dark:bg-dark-950">
            {/* Card-like Hero */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="relative rounded-2xl bg-light-50/5 dark:bg-dark-950/70 border border-light-100 dark:border-dark-800 p-6 lg:p-8 shadow-xl overflow-hidden">
                    {/* background removed per design — plain card */}

                    <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4">
                            <div>

                                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-wider text-light-400 dark:text-dark-300">{tr("project_library", "Project Library")}</span>
                                <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold text-light-900 dark:text-dark-50 leading-tight">
                                    <BilingualText value={projectName} size="lg" />
                                </h1>
                                <p className="mt-2 text-sm text-light-600 dark:text-dark-400 max-w-3xl">
                                    <BilingualText value={projectDescription} size="md" />
                                </p>

                            </div>

                            <div className="flex flex-col items-end gap-3">
                                <div className="flex items-center gap-3">
                                    <Link to="/projects" className="btn-ghost">{tr("back", "Back")}</Link>
                                    {projectId && (
                                        <Link to={`/projects/${projectId}/edit`} className="btn-primary">{tr("edit", "Edit")}</Link>
                                    )}
                                </div>

                                {(p.mainCover?.croppedUrl || p.mainCover?.url) && (
                                    <div className="hidden sm:block w-36 h-24 rounded-lg overflow-hidden border border-light-200 dark:border-dark-700">
                                        <img src={p.mainCover.croppedUrl || p.mainCover.url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("videos_count", "Videos")}</div>
                                <div className="mt-2 text-2xl font-bold text-light-700 dark:text-secdark-500">
                                    {groupedMaterials.reduce((count: number, m: any) => {
                                        if (m.type === "video") return count + 1;
                                        if (m.type === "bulk" && isVideoBulkType(m)) return count + buildVideoItems(m).length;
                                        return count;
                                    }, 0)}
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("photos_count", "Photos")}</div>
                                <div className="mt-2 text-2xl font-bold text-light-700 dark:text-secdark-500">
            {groupedMaterials.reduce((count: number, m: any) => {
                if (m.type === "video") return count + 1;
                if (m.type === "bulk" && isVideoBulkType(m)) return count + buildVideoItems(m).length;
                return count + buildPhotoItems(m).length;
            }, 0)}
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">BTS</div>
                                <div className="mt-2 text-2xl font-bold text-light-700 dark:text-secdark-500">
                                    {groupedMaterials.filter((m: any) => {
                                        const caption = localizedToString(m.caption) || "";
                                        return caption.toLowerCase().includes("bts");
                                    }).length || 0}
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("team_members_count", "Team Members")}</div>
                                <div className="mt-2 text-2xl font-bold text-light-700 dark:text-secdark-500">{p.cast?.length || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* View Controls */}
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-light-200 dark:border-dark-800">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-lg transition-colors ${
                                viewMode === "grid" 
                                    ? "bg-light-500 text-white dark:bg-secdark-700 dark:text-white" 
                                    : "bg-light-100 dark:bg-dark-800 text-light-600 dark:text-dark-400 hover:bg-light-200 dark:hover:bg-dark-700"
                            }`}
                        >
                            <Grid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-lg transition-colors ${
                                viewMode === "list" 
                                    ? "bg-light-500 text-white dark:bg-secdark-700 dark:text-white" 
                                    : "bg-light-100 dark:bg-dark-800 text-light-600 dark:text-dark-400 hover:bg-light-200 dark:hover:bg-dark-700"
                            }`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="text-sm text-light-500 dark:text-secdark-400">
                        {groupedMaterials.length || 0} {tr("materials_count", "materials")} • {p.cast?.length || 0} {tr("team_members_count", "team members")}
                    </div>
                </div>

                {/* Section: Basic Overview */}
                <Section id="overview" title={tr("project_overview", "Project Overview")} icon={Info}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                            <DetailRow label={tr("project_name_label", "Project Name")} value={projectName} icon={FolderTree} copyable copyId="name" bilingual />
                            <DetailRow label={tr("description", "Description")} value={projectDescription} icon={FileText} bilingual />
                            <DetailRow label={tr("location", "Location")} value={projectLocation} icon={MapPin} copyable copyId="location" bilingual />
                        </div>
                        <div className="space-y-3">
                            <DetailRow label={tr("published", "Published")} value={p.published ? tr("yes_value", "Yes") : tr("no_value", "No")} icon={Globe} />
                            <DetailRow label={tr("created_by", "Created By")} value={typeof p.createdBy === 'object' ? (p.createdBy.fullName || p.createdBy.name || 'Hidden') : 'Hidden'} icon={User} />
                            <DetailRow label={tr("parent_project", "Parent Project")} value={typeof p.parentProject === 'object' ? (p.parentProject?.name || 'Hidden') : 'Hidden'} icon={LinkIcon} />

                        </div>
                    </div>
                </Section>

               

                {/* Section: Categories & Tags */}
                <Section id="categories" title={tr("categories_and_tags", "Categories & Tags")} icon={Tag}>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-medium text-light-700 dark:text-dark-300 mb-3">{tr("categories_label", "Categories")}</h3>
                            <div className="flex flex-wrap gap-2">
                                {p.categories?.map((cat: any, idx: number) => (
                                    <span key={getOptionKey(cat, idx)} className="px-3 py-1.5 bg-light-500 text-white dark:bg-secdark-700 dark:text-white rounded-lg text-sm">
                                        <BilingualText value={cat?.name || cat} size="sm" className="text-white [&>span]:text-white/70" />
                                    </span>
                                )) || <span className="text-light-400 dark:text-dark-500">{tr("no_categories", "No categories")}</span>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-light-700 dark:text-dark-300 mb-3">{tr("tags_label", "Tags")}</h3>
                            <div className="flex flex-wrap gap-2">
                                {p.tags?.map((tag: any, idx: number) => (
                                    <span key={getOptionKey(tag, idx)} className="px-3 py-1.5 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300 rounded-lg text-sm">
                                        #<BilingualText value={tag?.name || tag} size="sm" />
                                    </span>
                                )) || <span className="text-light-400 dark:text-dark-500">{tr("no_tags", "No tags")}</span>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-light-700 dark:text-dark-300 mb-3">{tr("project_types", "Project Types")}</h3>
                            <div className="flex flex-wrap gap-2">
                                {p.types?.map((type: any, idx: number) => (
                                    <span key={getOptionKey(type, idx)} className="px-3 py-1.5 border border-light-200 dark:border-dark-700 text-light-700 dark:text-dark-300 rounded-lg text-sm">
                                        <BilingualText value={type?.name || type} size="sm" />
                                    </span>
                                )) || <span className="text-light-400 dark:text-dark-500">{tr("no_types", "No types")}</span>}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Section: Materials & Media */}
                <Section id="materials" title={tr("materials_and_media", "Materials & Media")} icon={Layers}>
                    <div className="mb-4 text-sm text-light-500 dark:text-secdark-400">
                        {tr("total", "Total:")} {groupedMaterials.length || 0} items • Types: {groupedMaterials.map((m: any) => m.type).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ") || "None"}
                    </div>
                    <div className={viewMode === "grid" 
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                        : "space-y-4"
                    }>
                        {groupedMaterials.map((m: any, idx: number) => renderMaterialItem(m, idx))}
                    </div>
                </Section>

                {/* Section: Cast & Crew */}
                <Section id="cast" title={tr("cast_and_crew", "Cast & Crew")} icon={Users}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayCast.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((c: any) => (
                            <div
                                key={c._id || c.name}
                                className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-light-200 dark:border-dark-700 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                            {(() => {
                                                const photoUrl = c.photo && (typeof c.photo === "string" ? c.photo : c.photo.url || c.photo.publicId);
                                                if (photoUrl) {
                                                    return <img src={photoUrl} alt={c.name || "Member"} className="w-12 h-12 rounded-full object-cover" />;
                                                }
                                                return (
                                                    <div className="w-12 h-12 bg-gradient-to-br from-light-200 to-light-300 dark:from-dark-700 dark:to-dark-600 rounded-full flex items-center justify-center">
                                                        <span className="text-lg font-medium text-light-600 dark:text-dark-300">
                                                            {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                            <div>
                                                <h3 className="font-semibold text-light-900 dark:text-dark-50">{c.name}</h3>
                                                <p className="text-sm text-light-500 dark:text-secdark-400">{c.title}</p>
                                            </div>
                                        </div>
                                    <span className="text-xs text-light-400 dark:text-dark-500">{tr("order_label", "Order:")} {c.order}</span>
                                </div>
                                <div className="pt-3 border-t border-light-100 dark:border-dark-700">
                                    <SocialLinkIcons links={c.socialLinks} size={15} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

               

                {/* Main cover shown in header preview; detailed section removed */}

                

              

                {/* Section: Statistics */}
                <Section id="stats" title={tr("statistics_and_summary", "Statistics & Summary")} icon={Award}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{groupedMaterials.length || 0}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("materials_count", "Materials")}</div>
                        </div>
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{p.cast?.length || 0}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("team_members_count", "Team Members")}</div>
                        </div>
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{p.categories?.length || 0}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("categories_label", "Categories")}</div>
                        </div>
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{p.tags?.length || 0}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("tags_label", "Tags")}</div>
                        </div>
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{p.types?.length || 0}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("project_types", "Project Types")}</div>
                        </div>
                        <div className="text-center p-4 bg-light-50 dark:bg-dark-800/50 rounded-lg border border-light-200 dark:border-dark-700">
                            <div className="text-2xl font-bold text-light-500 dark:text-secdark-500">{Object.keys(p).length}</div>
                            <div className="text-xs text-light-600 dark:text-dark-400">{tr("total_fields", "Total Fields")}</div>
                        </div>
                    </div>
                </Section>
            </div>

            {/* Media Modal */}
            {selectedMedia && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
                    onClick={() => setSelectedMedia(null)}
                >
                    <div
                        className="relative w-full max-w-6xl max-h-[90vh] bg-black rounded-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onWheel={(event) => {
                            if (!isPhotoMaterialType(selectedMedia?.type) && !(selectedMedia?.type === "bulk" && isVideoBulkType(selectedMedia))) return;
                            const items = selectedMedia?.type === "bulk" && isVideoBulkType(selectedMedia) ? buildVideoItems(selectedMedia) : buildPhotoItems(selectedMedia);
                            if (items.length <= 1) return;
                            event.preventDefault();
                            shiftSelectedPhoto(event.deltaY > 0 ? "next" : "prev");
                        }}
                    >
                        <button
                            onClick={() => setSelectedMedia(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                            {(() => {
                                const isPhotoType = isPhotoMaterialType(selectedMedia.type);
                                const isVidBulk = selectedMedia.type === "bulk" && isVideoBulkType(selectedMedia);
                                if (!isPhotoType && !isVidBulk) return null;
                                const selectedItems = isVidBulk ? buildVideoItems(selectedMedia) : buildPhotoItems(selectedMedia);
                                const totalPhotos = selectedItems.length;
                                const currentIndex = totalPhotos > 0
                                    ? Math.min(
                                        Math.max(
                                            Number.isFinite(Number(selectedMedia.selectedPhotoIndex))
                                                ? Number(selectedMedia.selectedPhotoIndex)
                                                : 0,
                                            0,
                                        ),
                                        totalPhotos - 1,
                                    )
                                    : 0;
                                const selectedPhoto = selectedMedia.selectedPhoto?.url
                                    ? selectedItems[currentIndex] || selectedMedia.selectedPhoto
                                    : selectedItems[0];

                                if (!selectedPhoto?.url) {
                                    return null;
                                }

                                const isVideoItem = selectedPhoto.type === "video";

                                return (
                                    <div className="relative w-full">
                                        {isVideoItem ? (
                                            <video
                                                src={selectedPhoto.url}
                                                controls
                                                autoPlay
                                                className="w-full h-auto max-h-[90vh] object-contain"
                                            />
                                        ) : (
                                            <img
                                                src={selectedPhoto.url}
                                                alt={selectedMedia.caption || selectedPhoto.originalName || "Project photo"}
                                                className="w-full h-auto max-h-[90vh] object-contain"
                                            />
                                        )}

                                        {totalPhotos > 1 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        shiftSelectedPhoto("prev");
                                                    }}
                                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/55 hover:bg-black/75 rounded-full text-white transition-colors"
                                                    aria-label="Previous photo"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        shiftSelectedPhoto("next");
                                                    }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/55 hover:bg-black/75 rounded-full text-white transition-colors"
                                                    aria-label="Next photo"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>

                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/55 text-white text-xs">
                                                    {currentIndex + 1} / {totalPhotos}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        
                        {localizedToString(selectedMedia.caption) && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <p className="text-white text-center"><BilingualText value={selectedMedia.caption} size="md" className="text-white [&>span]:text-white/70" /></p>
                                <div className="text-xs text-white/60 text-center mt-1">
                                            {/* ID removed for privacy */}
                                        </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetails;