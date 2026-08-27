import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLang } from "@/hooks/useLang";
import { useCreateProject, useProjectTypes, useProjectCast, useProjects, useProject, useCategories, useProjectCompanies, useCreateProjectCompany, projectsKeys } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import CastSocialLinks from "@/components/CastSocialLinks";
import SocialLinkIcons from "@/components/SocialLinkIcons";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { isDataUrl, needsUpload, uploadThumbnailToR2, uploadDataUrlToR2Cached, uploadDataUrlToR2, uploadFileToR2, runWithConcurrency } from "@/utils/r2Upload";
import { compressImageFileToMaxBytes } from "@/utils/imageCompression";
import { useAutoTranslatePair } from "@/hooks/useAutoTranslatePair";
import { stripHtml } from "@/utils/translateText";
import TranslateButton from "@/components/TranslateButton";
import { Autocomplete, TextField, Chip, Avatar } from "@mui/material";
import { Reorder, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
    Plus, X, ArrowLeft, CheckCircle, AlertCircle,
    Trash2, Edit, MapPin, Users, Layers, Loader2,
    Image as ImageIcon, Video, Code, Upload, GripVertical,
    Camera, User, FileText, Info, Copy
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";
import { createCategory } from "@/api/requests/categoriesService";
import { createType } from "@/api/requests/typesService";
import { createCast } from "@/api/requests/castService";
import { showAlert } from "@/utils/swal";

interface Material {
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
    items?: (PhotoMaterialItem | VideoMaterialItem)[];
  textContent?: any;
  htmlContent?: any;
    before?: { url: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
    after?: { url: string; label?: any; type?: string; mimeType?: string; originalName?: string; size?: number };
}

interface PhotoMaterialItem {
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    type?: "photo";
}

interface VideoMaterialItem {
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    thumbnail?: string;
    caption?: any;
    type?: "video";
    _file?: File;
}

interface Cast {
    _id?: string;
    name: string;
    title: string;
    order: number;
    clientId?: string;
    socialLinks?: { platform: string; url: string }[];
    photo?: any;
}

const MAX_PHOTO_THUMBNAIL_BYTES = 50 * 1024;

type PhotoItem = { url: string; mimeType?: string; size?: number; originalName?: string; type?: string };

const SortablePhotoItem: React.FC<{ item: PhotoItem; index: number; onRemove: (i: number) => void; removeLabel: string }> = ({ item, index, onRemove, removeLabel }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${item.originalName || item.url}-${index}` });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-3 border border-light-200 dark:border-dark-700 rounded-lg p-2 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-4 h-4 shrink-0 text-light-400 dark:text-dark-500" />
            <img src={item.url} alt={item.originalName || `Photo ${index + 1}`} className="shrink-0 w-12 h-12 object-cover rounded pointer-events-none" />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-light-900 dark:text-dark-50 truncate">{item.originalName || `Photo ${index + 1}`}</div>
                <div className="text-xs text-light-500 dark:text-dark-400">#{index + 1}</div>
            </div>
            <button type="button" onClick={() => onRemove(index)} className="shrink-0 p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors pointer-events-auto" title={removeLabel} aria-label={removeLabel}>
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

type SortableVideoItemProps = {
    item: VideoMaterialItem;
    index: number;
    onRemove: (i: number) => void;
    onThumbnailUpload: (index: number, file: File) => void;
    onRemoveThumbnail: (index: number) => void;
    onFrameSelect: (index: number, dataUrl: string) => void;
    onFrameSelectForCover: (dataUrl: string) => void;
    removeLabel: string;
    materialCaption?: any;
    materialDescription?: any;
};

const VideoFrameSelector: React.FC<{ videoUrl: string; onSelect: (dataUrl: string) => void; onSelectForCover?: (dataUrl: string) => void; onClose: () => void }> = ({ videoUrl, onSelect, onSelectForCover, onClose }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);

    // Use proxy URL to avoid CORS taint on canvas
    const proxyVideoUrl = React.useMemo(() => {
        if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) return videoUrl;
        return videoUrl.replace(/^https?:\/\/upload\.ats\.sabergroup-eg\.com/, '/r2-proxy');
    }, [videoUrl]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-4" onClick={onClose}>
            <div className="bg-dark-900 rounded-xl sm:rounded-2xl shadow-2xl w-full h-full max-w-[95vw] sm:max-w-[85vw] md:max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-dark-700 shrink-0">
                    <h3 className="text-sm sm:text-base font-semibold text-dark-50">Select Thumbnail Frame</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 flex flex-col p-3 sm:p-5 gap-3 sm:gap-4 overflow-hidden min-h-0">
                    <div className="flex-1 min-h-0 rounded-lg sm:rounded-xl overflow-hidden bg-black flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src={proxyVideoUrl}
                            className="max-w-full max-h-full rounded-lg"
                            controls
                            muted
                            preload="auto"
                            autoPlay={false}
                            playsInline={false}
                            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                        />
                    </div>

                    <div className="shrink-0 space-y-2">
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={(e) => {
                                const time = parseFloat(e.target.value);
                                setCurrentTime(time);
                                if (videoRef.current) videoRef.current.currentTime = time;
                            }}
                            className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <div className="flex justify-between text-xs text-dark-400">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="shrink-0 flex justify-end gap-2 sm:gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                const video = videoRef.current;
                                if (!video) return;
                                const time = video.currentTime;
                                if (!video.videoWidth || !video.videoHeight) {
                                    try {
                                        await video.play();
                                        await new Promise((r) => setTimeout(r, 200));
                                        video.pause();
                                        video.currentTime = time;
                                        await new Promise((r) => {
                                            const handler = () => { video.removeEventListener("seeked", handler); r(null); };
                                            video.addEventListener("seeked", handler);
                                            setTimeout(r, 1000);
                                        });
                                        await new Promise((r) => setTimeout(r, 100));
                                    } catch { /* ignore */ }
                                }
                                const w = video.videoWidth;
                                const h = video.videoHeight;
                                if (!w || !h) return;
                                const canvas = canvasRef.current || document.createElement("canvas");
                                canvasRef.current = canvas;
                                canvas.width = w;
                                canvas.height = h;
                                const ctx = canvas.getContext("2d");
                                if (!ctx) return;
                                ctx.drawImage(video, 0, 0, w, h);
                                onSelectForCover?.(canvas.toDataURL("image/jpeg", 0.85));
                            }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Camera className="w-4 h-4" />
                            <span className="hidden sm:inline">Capture for Main Cover</span>
                            <span className="sm:hidden">Cover</span>
                        </button>
                        <button
                            onClick={async () => {
                                const video = videoRef.current;
                                if (!video) return;
                                const time = video.currentTime;
                                if (!video.videoWidth || !video.videoHeight) {
                                    try {
                                        await video.play();
                                        await new Promise((r) => setTimeout(r, 200));
                                        video.pause();
                                        video.currentTime = time;
                                        await new Promise((r) => {
                                            const handler = () => { video.removeEventListener("seeked", handler); r(null); };
                                            video.addEventListener("seeked", handler);
                                            setTimeout(r, 1000);
                                        });
                                        await new Promise((r) => setTimeout(r, 100));
                                    } catch { /* ignore */ }
                                }
                                const w = video.videoWidth;
                                const h = video.videoHeight;
                                if (!w || !h) return;
                                const canvas = canvasRef.current || document.createElement("canvas");
                                canvasRef.current = canvas;
                                canvas.width = w;
                                canvas.height = h;
                                const ctx = canvas.getContext("2d");
                                if (!ctx) return;
                                ctx.drawImage(video, 0, 0, w, h);
                                onSelect(canvas.toDataURL("image/jpeg", 0.85));
                            }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Camera className="w-4 h-4" />
                            <span className="hidden sm:inline">Capture for Thumbnail</span>
                            <span className="sm:hidden">Thumbnail</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SortableVideoItem: React.FC<SortableVideoItemProps> = ({ item, index, onRemove, onThumbnailUpload, onRemoveThumbnail, onFrameSelect, onFrameSelectForCover, removeLabel, materialCaption, materialDescription }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${item.originalName || item.url}-${index}` });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };
    const thumbUrl = item.thumbnail || undefined;
    const caption = materialCaption || "";
    const description = materialDescription || "";
    const [showFrameSelector, setShowFrameSelector] = React.useState(false);
    return (
        <>
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-3 border border-light-200 dark:border-dark-700 rounded-lg p-2 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-4 h-4 shrink-0 text-light-400 dark:text-dark-500" />
            {thumbUrl ? (
                <img src={thumbUrl} alt={item.originalName || `Video ${index + 1}`} className="shrink-0 w-12 h-12 object-cover rounded pointer-events-none" />
            ) : (
                <video src={item.url} className="shrink-0 w-12 h-12 object-cover rounded pointer-events-none" muted preload="metadata" />
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-light-900 dark:text-dark-50 truncate">{item.originalName || `Video ${index + 1}`}</div>
                <div className="text-xs text-light-500 dark:text-dark-400">
                    #{index + 1}
                    {caption && <span className="ml-1 text-light-600 dark:text-dark-300">— {caption}</span>}
                </div>
                {description && (
                    <div className="text-xs text-light-400 dark:text-dark-500 truncate mt-0.5">{description}</div>
                )}
            </div>
            <button type="button" onClick={() => setShowFrameSelector(true)} onPointerDown={(e) => e.stopPropagation()} className="shrink-0 p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/30 text-primary-500 transition-colors pointer-events-auto" title="Select frame from video" aria-label="Select frame from video">
                <Video className="w-4 h-4" />
            </button>
            {thumbUrl ? (
                <button type="button" onClick={() => onRemoveThumbnail(index)} className="shrink-0 p-1.5 rounded-lg hover:bg-warning-50 dark:hover:bg-warning-950/30 text-warning-500 transition-colors pointer-events-auto" title="Remove thumbnail" aria-label="Remove thumbnail">
                    <ImageIcon className="w-4 h-4" />
                </button>
            ) : (
                <label className="shrink-0 p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/30 text-primary-500 transition-colors pointer-events-auto cursor-pointer" title="Upload thumbnail" aria-label="Upload thumbnail">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onThumbnailUpload(index, f); e.target.value = ""; }} />
                </label>
            )}
            <button type="button" onClick={() => onRemove(index)} className="shrink-0 p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors pointer-events-auto" title={removeLabel} aria-label={removeLabel}>
                <X className="w-4 h-4" />
            </button>
        </div>
        {showFrameSelector && (
            <VideoFrameSelector videoUrl={item.url} onSelect={(dataUrl) => { onFrameSelect(index, dataUrl); setShowFrameSelector(false); }} onSelectForCover={(dataUrl) => { onFrameSelectForCover(dataUrl); setShowFrameSelector(false); }} onClose={() => setShowFrameSelector(false)} />
        )}
        </>
    );
};

const STORAGE_KEY = "addproject_draft";

const AddProject: React.FC = () => {
    const { t, lang } = useLang();
    const navigate = useNavigate();
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

    const extractBackendError = (err: any): string => {
        const data = err?.response?.data;
        if (!data) return err?.message || "Failed to create project";
        const base = data.message || "Failed to create project";
        const details = data.details;
        if (Array.isArray(details) && details.length > 0) {
            const msgs = details.map((d: any) => d.message || d.msg || "").filter(Boolean);
            if (msgs.length > 0) return `${base}<br><br>${msgs.join("<br>")}`;
        }
        return base;
    };

    const toLocalizedString = (value: any): { ar: string; en: string } => {
        if (value && typeof value === "object") {
            return { ar: value.ar ?? "", en: value.en ?? "" };
        }
        return { ar: value || "", en: value || "" };
    };

    const localizeSideLabel = (side: any): any => {
        if (!side) return side;
        return { ...side, label: toLocalizedString(side.label) };
    };
    
    const mutation = useCreateProject();
    const queryClient = useQueryClient();
    // Replace useProjectCategories with useCategories
    const { data: projectCategoriesResponse, isLoading: projectCategoriesLoading } = useCategories({ type: "project" });
    const projectCategories = projectCategoriesResponse?.categories || [];
    const { data: projectTypes = [], isLoading: projectTypesLoading } = useProjectTypes();
    const { data: projectCast = []} = useProjectCast();
    const { data: projectCompanies = [] } = useProjectCompanies();
    const { data: allProjects = [] as any[]} = useProjects();
    const [cloneProjectId, setCloneProjectId] = useState("");
    const { data: cloneSourceProject } = useProject(cloneProjectId || undefined, { enabled: !!cloneProjectId });
    const [form, setForm] = useState<any>(() => {
        try {
            const draft = localStorage.getItem(STORAGE_KEY);
            if (draft) {
                const parsed = JSON.parse(draft);
                if (parsed.publishAt) {
                    parsed.publishAt = new Date(parsed.publishAt);
                }
                return parsed;
            }
        } catch {
            // ignore
        }
        return {
            name: { ar: "", en: "" },
            description: { ar: "", en: "" },
            location: { ar: "", en: "" },
            published: false,
            categories: [] as string[],
            tags: [] as string[],
            types: [] as string[],    
            publishAt: null as Date | null,
            shootedAt: null as Date | null,
            parentProject: null as any,
            company: null as any,
            materials: [] as Material[],
            cast: [] as Cast[],
            mainCover: null as any,
        };
    });
    
    const [newTag, setNewTag] = useState("");
    const [newTagAr, setNewTagAr] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [newCategoryAr, setNewCategoryAr] = useState("");
    const [newType, setNewType] = useState("");
    const [newTypeAr, setNewTypeAr] = useState("");
    const [selectedExistingCategory, setSelectedExistingCategory] = useState("");
    const [selectedExistingType, setSelectedExistingType] = useState("");
    const [newCompanyEn, setNewCompanyEn] = useState("");
    const [newCompanyAr, setNewCompanyAr] = useState("");
    const [newCompanyField, setNewCompanyField] = useState("");
    const [newCompanyLogo, setNewCompanyLogo] = useState("");
    const [activeTab, setActiveTab] = useState<"basic" | "materials" | "cast" | "media">("basic");

    // Persist form draft to localStorage (strip heavy media to avoid quota issues)
    useEffect(() => {
        try {
            const toSave = {
                ...form,
                materials: (form.materials || []).map((m: any) => {
                    if (!m) return m;
                    const stripped: any = { ...m };
                    // Strip blob URLs (pending uploads) — they can't survive a page refresh anyway
                    if (needsUpload(stripped.url)) stripped.url = "";
                    if (needsUpload(stripped.thumbnail)) stripped.thumbnail = "";
                    if (stripped.before && needsUpload(stripped.before.url)) stripped.before = { ...stripped.before, url: "" };
                    if (stripped.after && needsUpload(stripped.after.url)) stripped.after = { ...stripped.after, url: "" };
                    // Strip items with pending uploads
                    if (Array.isArray(stripped.items)) {
                        stripped.items = stripped.items.map((it: any) => {
                            if (!it) return it;
                            const clean: any = { ...it };
                            if (needsUpload(clean.url)) clean.url = "";
                            if (needsUpload(clean.thumbnail)) clean.thumbnail = "";
                            if (clean._file) delete clean._file;
                            return clean;
                        });
                    }
                    if (stripped._file) delete stripped._file;
                    return stripped;
                }),
                mainCover: form.mainCover && needsUpload(form.mainCover.url) ? null : form.mainCover,
            };
            if (toSave.publishAt instanceof Date) {
                toSave.publishAt = toSave.publishAt.toISOString();
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch {
            // ignore storage errors (e.g. quota exceeded)
        }
    }, [form]);

    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);

    const [editingCast, setEditingCast] = useState<Cast | null>(null);
    const [castModalMode, setCastModalMode] = useState<"add" | "edit">("add");
    const [editingCastIndex, setEditingCastIndex] = useState<number | null>(null);
    const [draggedCastIndex, setDraggedCastIndex] = useState<number | null>(null);
    const [newMembersRows, setNewMembersRows] = useState<Cast[]>([]);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const displayImgRef = useRef<HTMLImageElement | null>(null);
    const loadedImgRef = useRef<HTMLImageElement | null>(null);
    const [mainCoverMeta, setMainCoverMeta] = useState<{ width: number; height: number } | null>(null);
    const [cropEnabled, setCropEnabled] = useState(false);
    const [cropCenter, setCropCenter] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
    const [zoom, setZoom] = useState(1);
    const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
    const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number; center: { x: number; y: number } }>({ x: 0, y: 0, center: { x: 0.5, y: 0.5 } });
    const [coverPickerMaterialIdx, setCoverPickerMaterialIdx] = useState<number | null>(null);
    const coverPickerRef = useRef<HTMLDivElement>(null);

    // Close picker on outside click
    useEffect(() => {
        if (coverPickerMaterialIdx === null) return;
        const handler = (e: MouseEvent) => {
            if (coverPickerRef.current && !coverPickerRef.current.contains(e.target as Node)) {
                setCoverPickerMaterialIdx(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [coverPickerMaterialIdx]);

    const [showCoverPicker, setShowCoverPicker] = useState(false);
    const coverPickerAllRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showCoverPicker) return;
        const handler = (e: MouseEvent) => {
            if (coverPickerAllRef.current && !coverPickerAllRef.current.contains(e.target as Node)) {
                setShowCoverPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showCoverPicker]);

    // Submission progress UI state
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadLabel, setUploadLabel] = useState("");
    const [, setUploadedSteps] = useState(0);
    const [, setTotalSteps] = useState(0);
    const [estimatedSecondsLeft, setEstimatedSecondsLeft] = useState<number | null>(null);

    // Photo selection upload progress overlay
    const photoUpload = useUploadProgress();
    const photoSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // Do NOT auto-prefill `form.cast` from `projectCast` — users must add members manually
    const [selectedExistingCast, setSelectedExistingCast] = useState<any[]>([]);

    const nameEnToAr = useAutoTranslatePair(form.name?.en || "", form.name?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, name: { ...prev.name, ar: t } })));
    const nameArToEn = useAutoTranslatePair(form.name?.ar || "", form.name?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, name: { ...prev.name, en: t } })));
    const descEnToAr = useAutoTranslatePair(form.description?.en || "", form.description?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, description: { ...prev.description, ar: t } })));
    const descArToEn = useAutoTranslatePair(form.description?.ar || "", form.description?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, description: { ...prev.description, en: t } })));
    const locEnToAr = useAutoTranslatePair(form.location?.en || "", form.location?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, location: { ...prev.location, ar: t } })));
    const locArToEn = useAutoTranslatePair(form.location?.ar || "", form.location?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, location: { ...prev.location, en: t } })));
    const tagEnToAr = useAutoTranslatePair(newTag, newTagAr, "ar", setNewTagAr);
    const tagArToEn = useAutoTranslatePair(newTagAr, newTag, "en", setNewTag);
    const catEnToAr = useAutoTranslatePair(newCategory, newCategoryAr, "ar", setNewCategoryAr);
    const catArToEn = useAutoTranslatePair(newCategoryAr, newCategory, "en", setNewCategory);
    const typeEnToAr = useAutoTranslatePair(newType, newTypeAr, "ar", setNewTypeAr);
    const typeArToEn = useAutoTranslatePair(newTypeAr, newType, "en", setNewType);
    const companyEnToAr = useAutoTranslatePair(newCompanyEn, newCompanyAr, "ar", setNewCompanyAr);
    const companyArToEn = useAutoTranslatePair(newCompanyAr, newCompanyEn, "en", setNewCompanyEn);
    const matCaptionEnToAr = useAutoTranslatePair(editingMaterial?.caption?.en || "", editingMaterial?.caption?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, caption: { ...prev.caption, ar: t } } : prev)));
    const matCaptionArToEn = useAutoTranslatePair(editingMaterial?.caption?.ar || "", editingMaterial?.caption?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, caption: { ...prev.caption, en: t } } : prev)));
    const matTextEnToAr = useAutoTranslatePair(stripHtml(editingMaterial?.textContent?.en || ""), editingMaterial?.textContent?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, textContent: { ...prev.textContent, ar: t } } : prev)));
    const matTextArToEn = useAutoTranslatePair(stripHtml(editingMaterial?.textContent?.ar || ""), editingMaterial?.textContent?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, textContent: { ...prev.textContent, en: t } } : prev)));
    const matBeforeEnToAr = useAutoTranslatePair(editingMaterial?.before?.label?.en || "", editingMaterial?.before?.label?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, before: { ...prev.before, url: prev.before?.url || "", label: { ...prev.before?.label, ar: t } } } : prev)));
    const matBeforeArToEn = useAutoTranslatePair(editingMaterial?.before?.label?.ar || "", editingMaterial?.before?.label?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, before: { ...prev.before, url: prev.before?.url || "", label: { ...prev.before?.label, en: t } } } : prev)));
    const matAfterEnToAr = useAutoTranslatePair(editingMaterial?.after?.label?.en || "", editingMaterial?.after?.label?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, after: { ...prev.after, url: prev.after?.url || "", label: { ...prev.after?.label, ar: t } } } : prev)));
    const matAfterArToEn = useAutoTranslatePair(editingMaterial?.after?.label?.ar || "", editingMaterial?.after?.label?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, after: { ...prev.after, url: prev.after?.url || "", label: { ...prev.after?.label, en: t } } } : prev)));
    const matDescEnToAr = useAutoTranslatePair(editingMaterial?.description?.en || "", editingMaterial?.description?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, description: { ...prev.description, ar: t } } : prev)));
    const matDescArToEn = useAutoTranslatePair(editingMaterial?.description?.ar || "", editingMaterial?.description?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, description: { ...prev.description, en: t } } : prev)));

    const getOptionLabel = (value: any): string => {
        if (typeof value === "string") return value;
        if (!value || typeof value !== "object") return "";
        const name = value.name;
        if (name && typeof name === "object") return name.en || name.ar || "";
        if (value.en || value.ar) return value.en || value.ar || "";
        return name || value.title || value.label || value.value || value._id || value.id || "";
    };

    const getOptionValue = (value: any): string => {
        if (typeof value === "string") return value.trim();
        if (!value || typeof value !== "object") return "";
        return value._id || value.id || value.name || value.title || value.value || "";
    };

    // company names may be localized objects {en, ar} — resolve to a display string
    const getCompanyLabel = (opt: any): string => {
        if (!opt) return "";
        if (typeof opt === "string") return opt;
        const name = opt.name;
        if (name && typeof name === "object") return name.en || name.ar || name || "";
        return getOptionLabel(opt);
    };

    const makeLocalizedName = (en: string, ar: string): { en: string; ar: string } => ({ en: en.trim(), ar: ar.trim() });

    const normalizeArrayField = (arr: any[] = []): { en: string; ar: string }[] => {
        const seen = new Set<string>();
        const result: { en: string; ar: string }[] = [];
        for (const item of arr || []) {
            let en = "";
            let ar = "";
            if (typeof item === "string") {
                en = item.trim();
            } else if (item && typeof item === "object") {
                const name = item.name;
                if (name && typeof name === "object") {
                    en = String(name.en || "").trim();
                    ar = String(name.ar || "").trim();
                } else if (item.en !== undefined || item.ar !== undefined) {
                    en = String(item.en || "").trim();
                    ar = String(item.ar || "").trim();
                } else {
                    en = getOptionLabel(item).trim();
                }
            }
            if (!en) continue;
            const key = `${en.toLowerCase()}__${ar.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({ en, ar });
        }
        return result;
    };

    const resolveTaxonomyIds = async (items: any[], kind: "category" | "type"): Promise<string[]> => {
        const options = kind === "category" ? projectCategories : projectTypes;
        const resolved: string[] = [];
        for (const item of items || []) {
            // If the item already has a valid _id (e.g. selected from dropdown), use it directly
            const existingId = getOptionValue(item);
            if (existingId && /^[0-9a-fA-F]{24}$/.test(String(existingId))) {
                resolved.push(String(existingId));
                continue;
            }
            const label = getOptionLabel(item).trim();
            if (!label) continue;
            const existing = options.find((o: any) => getOptionLabel(o).toLowerCase() === label.toLowerCase());
            if (existing && getOptionValue(existing)) {
                resolved.push(getOptionValue(existing));
                continue;
            }
            const ar = item && typeof item === "object" ? String(item.ar || "").trim() : "";
            const created = kind === "category"
                ? await createCategory({ name: { en: label, ar }, type: "project" })
                : await createType({ name: { en: label, ar } });
            const createdId = (created as any)?._id || (created as any)?.id;
            if (createdId) resolved.push(createdId);
        }
        return resolved.filter(Boolean);
    };

    const isSameOption = (a: any, b: any): boolean => {
        const aId = a && typeof a === "object" ? String(a._id || a.id || "").trim() : "";
        const bId = b && typeof b === "object" ? String(b._id || b.id || "").trim() : "";
        if (aId && bId) return aId === bId;

        return getOptionLabel(a).trim().toLowerCase() === getOptionLabel(b).trim().toLowerCase();
    };

    const taxonomyAutocompleteSx = {
        fontFamily: "inherit",
        "& .MuiOutlinedInput-root": {
            minHeight: "2.5rem",
            borderRadius: "0.75rem",
            backgroundColor: "var(--color-white)",
            fontFamily: "inherit",
            "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--color-light-200)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--color-light-300)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--color-light-500)",
            },
        },
        "& .MuiInputBase-input, & .MuiAutocomplete-input": {
            color: "var(--color-light-900)",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            textTransform: "none",
        },
        "& .MuiInputBase-input::placeholder, & .MuiAutocomplete-input::placeholder": {
            color: "var(--color-light-400)",
            opacity: 1,
        },
        "& .MuiChip-root": {
            borderRadius: "0.5rem",
            backgroundColor: "var(--color-light-100)",
            color: "var(--color-light-700)",
            border: "1px solid var(--color-light-200)",
            height: "1.6rem",
            fontFamily: "inherit",
        },
        "& .MuiChip-label": {
            fontFamily: "inherit",
            textTransform: "none",
        },
        "& .MuiChip-deleteIcon": {
            color: "var(--color-light-500)",
        },
        "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": {
            color: "var(--color-light-500)",
        },
        ".dark & .MuiOutlinedInput-root": {
            backgroundColor: "var(--color-dark-900)",
        },
        ".dark & .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-dark-700)",
        },
        ".dark & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-dark-600)",
        },
        ".dark & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-secdark-700)",
        },
        ".dark & .MuiInputBase-input, .dark & .MuiAutocomplete-input": {
            color: "var(--color-dark-50)",
            fontFamily: "inherit",
        },
        ".dark & .MuiInputBase-input::placeholder, .dark & .MuiAutocomplete-input::placeholder": {
            color: "var(--color-dark-500)",
            opacity: 1,
        },
        ".dark & .MuiChip-root": {
            backgroundColor: "var(--color-dark-800)",
            color: "var(--color-dark-200)",
            borderColor: "var(--color-dark-700)",
            fontFamily: "inherit",
        },
        ".dark & .MuiChip-deleteIcon": {
            color: "var(--color-dark-400)",
        },
        ".dark & .MuiAutocomplete-popupIndicator, .dark & .MuiAutocomplete-clearIndicator": {
            color: "var(--color-dark-400)",
        },
    };

    const taxonomyAutocompleteSlotProps = {
        paper: {
            sx: {
                fontFamily: "inherit",
                mt: "0.5rem",
                borderRadius: "0.9rem",
                border: "1px solid var(--color-light-200)",
                backgroundColor: "var(--color-light-50)",
                color: "var(--color-light-900)",
                boxShadow: "0 20px 40px rgba(17, 24, 39, 0.12)",
                overflow: "hidden",
                "& .MuiAutocomplete-listbox": {
                    padding: "0.4rem",
                    maxHeight: "18rem",
                },
                "& .MuiAutocomplete-option": {
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    textTransform: "none",
                    borderRadius: "0.625rem",
                    minHeight: "2.25rem",
                    color: "var(--color-light-900)",
                    transition: "background-color 160ms ease, color 160ms ease",
                },
                "& .MuiAutocomplete-option.Mui-focused": {
                    backgroundColor: "var(--color-light-100)",
                },
                "& .MuiAutocomplete-option[aria-selected='true']": {
                    backgroundColor: "var(--color-light-200)",
                    color: "var(--color-light-800)",
                    fontWeight: 600,
                },
                "& .MuiAutocomplete-option[aria-selected='true'].Mui-focused": {
                    backgroundColor: "var(--color-light-300)",
                },
                "& .MuiAutocomplete-noOptions": {
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    color: "var(--color-light-500)",
                },
                ".dark &": {
                    borderColor: "var(--color-dark-700)",
                    backgroundColor: "var(--color-dark-900)",
                    color: "var(--color-dark-50)",
                    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.45)",
                },
                ".dark & .MuiAutocomplete-option": {
                    color: "var(--color-dark-100, var(--color-dark-50))",
                },
                ".dark & .MuiAutocomplete-option.Mui-focused": {
                    backgroundColor: "var(--color-dark-800)",
                },
                ".dark & .MuiAutocomplete-option[aria-selected='true']": {
                    backgroundColor: "rgba(185, 28, 28, 0.24)",
                    color: "var(--color-dark-50)",
                },
                ".dark & .MuiAutocomplete-option[aria-selected='true'].Mui-focused": {
                    backgroundColor: "rgba(185, 28, 28, 0.36)",
                },
                ".dark & .MuiAutocomplete-noOptions": {
                    color: "var(--color-dark-400)",
                },
            },
        },
        popper: {
            sx: {
                zIndex: 1400,
            },
        },
    };

    const emptyForm = () => ({
        name: { ar: "", en: "" },
        description: { ar: "", en: "" },
        location: { ar: "", en: "" },
        order: (allProjects?.length || 0) + 1,
        published: false,
        categories: [] as string[],
        tags: [] as string[],
        types: [] as string[],
        publishAt: null as Date | null,
        parentProject: null as any,
        company: null as any,
        materials: [] as Material[],
        cast: [] as Cast[],
        mainCover: null as any,
    });

    const resetCloneSelection = () => {
        setCloneProjectId("");
        setForm(emptyForm());
    };

    const applyCloneData = (source: any) => {
        if (!source) return;

        const rawParent: any = source.parentProject;
        let parentInitial: any = null;
        if (rawParent) {
            if (typeof rawParent === "string") {
                const found = allProjects.find((p: any) => (p.id || p._id) === rawParent || p.name === rawParent);
                parentInitial = found || rawParent;
            } else if (typeof rawParent === "object") {
                const pid = rawParent._id || rawParent.id;
                const found = pid ? allProjects.find((p: any) => (p.id || p._id) === pid) : null;
                parentInitial = found || rawParent;
            }
        }

        const rawCompany: any = source.company;
        let companyInitial: any = null;
        if (rawCompany) {
            if (typeof rawCompany === "string") {
                const found = projectCompanies.find((pc: any) => (pc._id || pc.id) === rawCompany);
                companyInitial = found || rawCompany;
            } else if (typeof rawCompany === "object") {
                const cid = rawCompany._id || rawCompany.id;
                const found = cid ? projectCompanies.find((pc: any) => (pc._id || pc.id) === cid) : null;
                companyInitial = found || rawCompany;
            }
        }

        const rawCast = source.cast || [];
        const mappedCast = (Array.isArray(rawCast) ? rawCast : []).map((c: any, idx: number) => {
            if (!c) return { name: "", title: "", order: idx + 1 };

            if (typeof c === "string") {
                const found = projectCast.find((pc: any) => (pc._id || pc.id) === c || pc.name === c);
                return {
                    _id: found?._id || undefined,
                    name: found?.name || c,
                    title: (found as any)?.title || "",
                    socialLinks: (found as any)?.socialLinks || [],
                    photo: (found as any)?.photo || null,
                    order: idx + 1,
                };
            }

            if (typeof c === "object") {
                if (c.castId) {
                    const castEntry = c.castId;
                    if (typeof castEntry === "string") {
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
                    if (typeof castEntry === "object") {
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
        }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

        const srcName = source.localizedName ?? source.name;
        const srcDesc = source.localizedDescription ?? source.description;
        const srcLoc = source.localizedLocation ?? source.location;

        setForm({
            name: toLocalizedString(srcName),
            description: toLocalizedString(srcDesc),
            location: toLocalizedString(srcLoc),
            order: Number(source.order) || (allProjects?.length || 0) + 1,
            published: source.published || false,
            publishAt: source.publishedAt ? new Date(source.publishedAt) : null,
            categories: source.categories || [],
            tags: source.tags || [],
            types: source.types || [],
            materials: [],
            cast: mappedCast,
            mainCover: null,
            parentProject: parentInitial,
            company: companyInitial,
        });
    };

    useEffect(() => {
        if (!cloneProjectId || !cloneSourceProject) return;
        applyCloneData(cloneSourceProject);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cloneProjectId, cloneSourceProject]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setForm({ ...form, [name]: checked });
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    // Tag Management
    const existingTags = React.useMemo(() => {
        const tagSet = new Set<string>();
        (allProjects || []).forEach((p: any) => {
            (p.tags || []).forEach((t: any) => {
                const label = getOptionLabel(t);
                if (label) tagSet.add(label.toLowerCase());
            });
        });
        const tags: { en: string; ar: string }[] = [];
        tagSet.forEach((label) => {
            (allProjects || []).forEach((p: any) => {
                (p.tags || []).forEach((t: any) => {
                    const l = getOptionLabel(t);
                    if (l && l.toLowerCase() === label) {
                        const existing = tags.find((x) => x.en.toLowerCase() === label);
                        if (!existing) {
                            tags.push(typeof t === "object" && t.en ? { en: t.en, ar: t.ar || "" } : { en: l, ar: "" });
                        }
                    }
                });
            });
        });
        return tags.sort((a, b) => a.en.localeCompare(b.en));
    }, [allProjects]);

    const handleSelectExistingTag = (enValue: string) => {
        if (!enValue) return;
        const tag = existingTags.find((t) => t.en === enValue);
        if (!tag) return;
        const alreadyAdded = form.tags.some((t: any) => getOptionLabel(t).toLowerCase() === tag.en.toLowerCase());
        if (!alreadyAdded) {
            setForm({ ...form, tags: [...form.tags, tag.ar ? tag : tag.en] });
        }
    };

    const handleAddTag = () => {
        const next = newTag.trim();
        const ar = newTagAr.trim();
        if (!next) return;
        const exists = form.tags.some((t: any) => getOptionLabel(t).toLowerCase() === next.toLowerCase());
        if (exists) {
            setNewTag("");
            setNewTagAr("");
            return;
        }
        setForm({ ...form, tags: [...form.tags, ar ? makeLocalizedName(next, ar) : next] });
        setNewTag("");
        setNewTagAr("");
    };

    const handleRemoveTag = (tag: any) => {
        setForm({ ...form, tags: form.tags.filter((t: any) => !isSameOption(t, tag)) });
    };

    const handleRemoveCategory = (cat: any) => {
        setForm({ ...form, categories: form.categories.filter((c: any) => !isSameOption(c, cat)) });
    };

    const handleRemoveType = (type: any) => {
        setForm({ ...form, types: form.types.filter((t: any) => !isSameOption(t, type)) });
    };

    const handleAddCategory = () => {
        const next = newCategory.trim();
        const ar = newCategoryAr.trim();
        if (!next) return;
        const exists = form.categories.some((c: any) => getOptionLabel(c).toLowerCase() === next.toLowerCase());
        if (exists) {
            setNewCategory("");
            setNewCategoryAr("");
            return;
        }
        setForm({ ...form, categories: [...form.categories, { en: next, ar }] });
        setNewCategory("");
        setNewCategoryAr("");
    };

    const handleAddType = () => {
        const next = newType.trim();
        const ar = newTypeAr.trim();
        if (!next) return;
        const exists = form.types.some((t: any) => getOptionLabel(t).toLowerCase() === next.toLowerCase());
        if (exists) {
            setNewType("");
            setNewTypeAr("");
            return;
        }
        setForm({ ...form, types: [...form.types, { en: next, ar }] });
        setNewType("");
        setNewTypeAr("");
    };

    const handleSelectExistingCategory = (value: string) => {
        const idx = Number(value);
        const selected = projectCategories[idx];
        if (!selected) return;
        if (!form.categories.some((c: any) => isSameOption(c, selected))) {
            setForm({ ...form, categories: [...form.categories, selected] });
        }
    };

    const handleSelectExistingType = (value: string) => {
        const idx = Number(value);
        const selected = projectTypes[idx];
        if (!selected) return;
        if (!form.types.some((t: any) => isSameOption(t, selected))) {
            setForm({ ...form, types: [...form.types, selected] });
        }
    };

    const createCompanyMutation = useCreateProjectCompany();

    const handleCompanyLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await photoUpload.run({
                title: "Uploading logo...",
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    const uploaded = await uploadDataUrlToR2(dataUrl, {
                        fileName: file.name || `company-${Date.now()}.jpg`,
                        resourceType: "image",
                    });
                    setNewCompanyLogo(uploaded.url);
                },
            });
        } catch (e: any) {
            console.error("Failed to upload company logo:", e);
        } finally {
            e.target.value = "";
        }
    };

    const handleAddCompany = async () => {
        const en = newCompanyEn.trim();
        const ar = newCompanyAr.trim();
        if (!en || !ar) return;
        try {
            const created = await createCompanyMutation.mutateAsync({
                name: { en, ar },
                field: newCompanyField.trim() || undefined,
                logo: newCompanyLogo || undefined,
            });
            setForm({ ...form, company: created });
            setNewCompanyEn("");
            setNewCompanyAr("");
            setNewCompanyField("");
            setNewCompanyLogo("");
        } catch (e: any) {
            console.error("Failed to create company:", e);
        }
    };

    const readFileAsDataUrl = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });

    const isPhotoMaterialType = (type?: string): boolean => type === "photo" || type === "bulk";
    const isVideoBulkType = (material: any): boolean => {
        if (material?.type !== "bulk") return false;
        const items = buildVideoItems(material);
        return items.length > 0 && (items[0]?.mimeType || "").startsWith("video/");
    };


    const buildPhotoItems = (material: Partial<Material>): PhotoMaterialItem[] => {
        const merged: PhotoMaterialItem[] = [];

        if (material.url) {
            merged.push({
                url: material.url,
                mimeType: material.mimeType,
                originalName: material.originalName,
                size: material.size,
                type: "photo",
            });
        }

        if (Array.isArray(material.items)) {
            material.items
                .filter((item): item is PhotoMaterialItem => !!item?.url)
                .forEach((item) => {
                    merged.push({
                        url: item.url,
                        mimeType: item.mimeType || material.mimeType,
                        originalName: item.originalName,
                        size: item.size,
                        type: "photo",
                    });
                });
        }

        const seen = new Set<string>();
        return merged.filter((item) => {
            const key = item.url.trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const buildVideoItems = (material: Partial<Material>): VideoMaterialItem[] => {
        const merged: VideoMaterialItem[] = [];

        if (material.url && material.type === "video") {
            const primaryItem: any = Array.isArray(material.items) ? material.items[0] : undefined;
            const primaryThumb = primaryItem?.thumbnail
                ? (typeof primaryItem.thumbnail === "string" ? primaryItem.thumbnail : primaryItem.thumbnail?.url)
                : (typeof material.thumbnail === "string" ? material.thumbnail : material.thumbnail?.url);
            merged.push({
                url: material.url,
                mimeType: material.mimeType,
                originalName: material.originalName,
                size: material.size,
                thumbnail: primaryThumb,
                type: "video",
                _file: primaryItem?._file || (material as any)._file,
            });
        }

        if (Array.isArray(material.items)) {
            material.items
                .filter((item): item is VideoMaterialItem => !!item?.url)
                .forEach((item: any, idx: number) => {
                    if (material.url && material.type === "video" && idx === 0) return;
                    merged.push({
                        url: item.url,
                        mimeType: item.mimeType || material.mimeType,
                        originalName: item.originalName,
                        size: item.size,
                        thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : item.thumbnail?.url,
                        type: "video",
                        _file: item._file,
                    });
                });
        }

        const seen = new Set<string>();
        return merged.filter((item) => {
            const key = item.url.trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const normalizeVideoMaterial = (material: Material): Material => {
        if (material.type !== "video" && material.type !== "bulk") {
            return material;
        }

        const items = buildVideoItems(material);
        const primary = items[0];

        return {
            ...material,
            items,
            url: primary?.url || "",
            mimeType: primary?.mimeType || material.mimeType,
            originalName: primary?.originalName || material.originalName,
            size: primary?.size || material.size,
        };
    };

    const normalizePhotoMaterial = (material: Material): Material => {
        if (!isPhotoMaterialType(material.type)) {
            return material;
        }

        const items = buildPhotoItems(material);
        const primary = items[0];

        return {
            ...material,
            type: "photo",
            items,
            url: primary?.url || "",
            mimeType: primary?.mimeType || material.mimeType,
            originalName: primary?.originalName || material.originalName,
            size: primary?.size || material.size,
        };
    };

    // Material Management
    const handleAddMaterial = () => {
        const newMaterial: Material = {
            type: "photo",
            order: form.materials.length + 1,
            caption: { ar: "", en: "" },
            url: "",
            mimeType: "image/jpeg",
            items: [],
        };
        setForm({
            ...form,
            materials: [...form.materials, newMaterial],
        });
        setEditingMaterial(newMaterial);
        setEditingMaterialIndex(form.materials.length);
    };

    const handleEditMaterial = (material: Material, index: number) => {
        let normalized = { ...material };
        if (material.type === "video" || (material.type === "bulk" && isVideoBulkType(material))) {
            normalized = normalizeVideoMaterial(normalized);
        } else if (isPhotoMaterialType(material.type)) {
            normalized = normalizePhotoMaterial(normalized);
        }
        setEditingMaterial(normalized);
        setEditingMaterialIndex(index);
    };

    const handleSaveMaterial = () => {
        if (editingMaterial) {
            let materialToSave = editingMaterial;
            if (editingMaterial.type === "video" || (editingMaterial.type === "bulk" && isVideoBulkType(editingMaterial))) {
                materialToSave = normalizeVideoMaterial(editingMaterial);
            } else if (isPhotoMaterialType(editingMaterial.type)) {
                materialToSave = normalizePhotoMaterial(editingMaterial);
            }
            if (editingMaterialIndex !== null) {
                setForm({
                    ...form,
                    materials: form.materials.map((m: Material, idx: number) =>
                        idx === editingMaterialIndex ? materialToSave : m
                    ),
                });
            } else {
                setForm({
                    ...form,
                    materials: [...form.materials, { ...materialToSave, order: form.materials.length + 1 }],
                });
            }
            setEditingMaterial(null);
            setEditingMaterialIndex(null);
        }
    };

    const handleMaterialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !editingMaterial) return;

        try {
            await photoUpload.run({
                title: editingMaterial.type === "photo" ? "Uploading photo..." : "Uploading video...",
                label: files.length > 1 ? `${files.length} files` : files[0].name,
                task: async () => {
                    if (editingMaterial.type === "photo") {
                        const uploadedItems: PhotoMaterialItem[] = await Promise.all(
                            files.map(async (file) => {
                                const optimizedFile = await compressImageFileToMaxBytes(file, {
                                    maxBytes: MAX_PHOTO_THUMBNAIL_BYTES,
                                });

                                return {
                                    url: await readFileAsDataUrl(optimizedFile),
                                    mimeType: optimizedFile.type || file.type,
                                    size: optimizedFile.size || file.size,
                                    originalName: optimizedFile.name || file.name,
                                    type: "photo" as const,
                                };
                            })
                        );

                        uploadedItems.forEach((item) => {
                            uploadDataUrlToR2Cached(item.url, {
                                resourceType: "image",
                                fileName: item.originalName || "project-photo.jpg",
                            }).catch(() => {});
                        });

                        setEditingMaterial((prev) => {
                            if (!prev || prev.type !== "photo") return prev;
                            const items = [...buildPhotoItems(prev), ...uploadedItems];
                            const primary = items[0];
                            return {
                                ...prev,
                                items,
                                url: primary?.url || "",
                                mimeType: primary?.mimeType || prev.mimeType,
                                size: primary?.size || prev.size,
                                originalName: primary?.originalName || prev.originalName,
                            };
                        });
                    } else if (editingMaterial.type === "video" || editingMaterial.type === "bulk") {
                        const uploadedItems: VideoMaterialItem[] = files.map((file) => {
                            const objectUrl = URL.createObjectURL(file);
                            return {
                                url: objectUrl,
                                mimeType: file.type,
                                size: file.size,
                                originalName: file.name,
                                type: "video" as const,
                                _file: file,
                            };
                        });

                        setEditingMaterial((prev) => {
                            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
                            const existingItems = buildVideoItems(prev);
                            const items = [...existingItems, ...uploadedItems];
                            const primary = items[0];
                            return {
                                ...prev,
                                items,
                                url: primary?.url || "",
                                mimeType: primary?.mimeType || prev.mimeType,
                                size: primary?.size || prev.size,
                                originalName: primary?.originalName || prev.originalName,
                            };
                        });
                    } else {
                        const file = files[0];
                        const dataUrl = await readFileAsDataUrl(file);
                        uploadDataUrlToR2Cached(dataUrl, {
                            resourceType: "video",
                            fileName: file.name,
                        }).catch(() => {});
                        setEditingMaterial((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      url: dataUrl,
                                      mimeType: file.type,
                                      size: file.size,
                                      originalName: file.name,
                                  }
                                : prev
                        );
                    }
                },
            });
        } catch {
            // Ignore file read errors and keep the current editor state unchanged.
        } finally {
            e.target.value = "";
        }
    };

    const handleRemovePhotoItem = (itemIndex: number) => {
        setEditingMaterial((prev) => {
            if (!prev || prev.type !== "photo") return prev;
            const items = buildPhotoItems(prev).filter((_, idx) => idx !== itemIndex);
            const primary = items[0];
            return {
                ...prev,
                items,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleRemoveVideoItem = (itemIndex: number) => {
        setEditingMaterial((prev) => {
            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
            const items = buildVideoItems(prev).filter((_, idx) => idx !== itemIndex);
            const primary = items[0];
            return {
                ...prev,
                items,
                thumbnail: primary?.thumbnail ? { url: primary.thumbnail } : undefined,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleVideoItemThumbnailUpload = (itemIndex: number, file: File) => {
        setEditingMaterial((prev) => {
            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
            const thumbUrl = URL.createObjectURL(file);
            const items = buildVideoItems(prev).map((item, idx) => {
                if (idx !== itemIndex) return item;
                return { ...item, thumbnail: thumbUrl };
            });
            const primary = items[0];
            return {
                ...prev,
                items,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleRemoveVideoItemThumbnail = (itemIndex: number) => {
        setEditingMaterial((prev) => {
            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
            const items = buildVideoItems(prev).map((item, idx) => {
                if (idx !== itemIndex) return item;
                return { ...item, thumbnail: undefined };
            });
            const primary = items[0];
            return {
                ...prev,
                items,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleVideoItemFrameSelect = (itemIndex: number, dataUrl: string) => {
        setEditingMaterial((prev) => {
            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
            const items = buildVideoItems(prev).map((item, idx) => {
                if (idx !== itemIndex) return item;
                return { ...item, thumbnail: dataUrl };
            });
            const primary = items[0];
            return {
                ...prev,
                items,
                thumbnail: dataUrl,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleCaptureFrameForCover = (dataUrl: string) => {
        setForm((prev: any) => ({
            ...prev,
            mainCover: {
                url: dataUrl,
                mimeType: "image/jpeg",
                originalName: "frame-from-video",
                size: 0,
            },
        }));
        showAlert(tr("imported_to_cover", "Frame imported as main cover"), "success");
    };

    const handleResetProject = () => {
        localStorage.removeItem(STORAGE_KEY);
        setForm({
            name: { ar: "", en: "" },
            description: { ar: "", en: "" },
            location: { ar: "", en: "" },
            published: false,
            categories: [],
            tags: [],
            types: [],
            publishAt: null,
            shootedAt: null,
            parentProject: null,
            company: null,
            materials: [],
            cast: [],
            mainCover: null,
        });
        setEditingMaterial(null);
        setEditingMaterialIndex(null);
        setSaveStatus("idle");
        showAlert(tr("project_reset", "Project data has been cleared"), "success");
    };

    const handleVideoItemReorder = (newItems: VideoMaterialItem[]) => {
        setEditingMaterial((prev) => {
            if (!prev || (prev.type !== "video" && prev.type !== "bulk")) return prev;
            const primary = newItems[0];
            return {
                ...prev,
                items: newItems,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handlePhotoItemReorder = (newItems: PhotoMaterialItem[]) => {
        setEditingMaterial((prev) => {
            if (!prev || prev.type !== "photo") return prev;
            const primary = newItems[0];
            return {
                ...prev,
                items: newItems,
                url: primary?.url || "",
                mimeType: primary?.mimeType,
                originalName: primary?.originalName,
                size: primary?.size,
            };
        });
    };

    const handleMaterialsReorder = (newMaterials: Material[]) => {
        setForm((prev: any) => ({
            ...prev,
            materials: newMaterials.map((m: Material, idx: number) => ({ ...m, order: idx + 1 })),
        }));
    };

    const handleBeforeAfterUpload = async (e: React.ChangeEvent<HTMLInputElement>, which: 'before' | 'after') => {
        const file = e.target.files?.[0];
        if (!file || !editingMaterial) return;
        try {
            await photoUpload.run({
                title: "Uploading photo...",
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    uploadDataUrlToR2Cached(dataUrl, {
                        resourceType: "image",
                        fileName: file.name,
                    }).catch(() => {});
                    setEditingMaterial({
                        ...editingMaterial,
                        [which]: {
                            ...((editingMaterial as any)[which] || {}),
                            url: dataUrl,
                            mimeType: file.type,
                            originalName: file.name,
                            size: file.size,
                            label: which === 'before' ? { ar: 'قبل', en: 'Before' } : { ar: 'بعد', en: 'After' },
                            type: 'photo',
                        },
                    } as any);
                },
            });
        } catch {
            // ignore
        }
    };

    const handleDeleteMaterial = (materialId?: string | null, index?: number) => {
        setForm((prev: any) => {
            let nextMaterials: Material[] = [];

            if (materialId) {
                // remove by _id for existing materials
                nextMaterials = prev.materials.filter((m: Material) => String(m._id || "") !== String(materialId));
            } else if (typeof index === "number") {
                // remove by index for newly-added materials without an _id
                nextMaterials = prev.materials.filter((_: any, i: number) => i !== index);
            } else {
                // nothing to delete
                return prev;
            }

            // reassign order numbers
            nextMaterials = nextMaterials.map((m: Material, idx: number) => ({ ...m, order: idx + 1 }));

            return {
                ...prev,
                materials: nextMaterials,
            };
        });
    };



    // Cast Management
    const getCastPhotoUrl = (photo: any): string => {
        if (!photo) return "";
        if (typeof photo === "string") return photo;
        return photo.url || photo.publicId || "";
    };

    const handleCastPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingCast) return;
        try {
            await photoUpload.run({
                title: "Uploading photo...",
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    setEditingCast((prev) =>
                        prev
                            ? { ...prev, photo: { url: dataUrl, mimeType: file.type, originalName: file.name, size: file.size } }
                            : prev
                    );
                },
            });
        } catch {
            // ignore
        }
        if (e.target) e.target.value = "";
    };

    const handleCastRowPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, rIdx: number) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await photoUpload.run({
                title: "Uploading photo...",
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    setNewMembersRows((prev) =>
                        prev.map((p, i) => (i === rIdx ? { ...p, photo: { url: dataUrl, mimeType: file.type, originalName: file.name, size: file.size } } : p))
                    );
                },
            });
        } catch {
            // ignore
        }
        if (e.target) e.target.value = "";
    };

    const handleAddCast = () => {
        const nextOrder = form.cast.length + 1;
        setCastModalMode("add");
        setEditingCastIndex(null);
        setEditingCast({
            name: "",
            title: "",
            order: nextOrder,
            socialLinks: [],
        });
        setNewMembersRows([{ name: "", title: "", order: nextOrder, socialLinks: [], photo: null }]);
        setSelectedExistingCast([]);
    };

    const handleEditCast = (cast: Cast, index: number) => {
        const found = projectCast.find((pc: any) => cast._id && (pc._id || pc.id) === cast._id);
        setCastModalMode("edit");
        setEditingCastIndex(index);
        setEditingCast({
            ...cast,
            title: cast.title || (found as any)?.title || "",
            socialLinks: cast.socialLinks?.length ? cast.socialLinks : (found as any)?.socialLinks || [],
            photo: cast.photo || (found as any)?.photo || null,
        });
    };

    const handleSaveCast = () => {
        if (!editingCast) return;

        if (castModalMode === "edit") {
            // Update member at its list position (works for both saved and unsaved members)
            if (editingCastIndex === null) return;
            setForm((prev: any) => ({
                ...prev,
                cast: prev.cast.map((c: Cast, i: number) => (i === editingCastIndex ? { ...c, ...editingCast } : c)),
            }));
            setEditingCast(null);
            queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
            return;
        }

        // Add selected existing members (as full objects for UI, but mark them)
        const existing = selectedExistingCast || [];
        const rows = (newMembersRows || []).filter((r) => (r.name || "").trim());

        if (existing.length || rows.length) {
            setForm((prev: any) => {
                const next = [...prev.cast];
                existing.forEach((ex) => {
                    next.push({
                        _id: ex._id || ex.id,
                        name: ex.name || "",
                        title: ex.title || "",
                        order: next.length + 1,
                        socialLinks: ex.socialLinks || [],
                        photo: ex.photo || null,
                        __existing: true,
                    });
                });

                rows.forEach((r) => {
                    next.push({ name: r.name, title: r.title || "", order: next.length + 1, socialLinks: r.socialLinks || [], photo: r.photo || null });
                });

                return { ...prev, cast: next };
            });

            setSelectedExistingCast([]);
            setNewMembersRows([]);
            setEditingCast(null);
            queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
            return;
        }

        // Add single (fallback)
        setForm((prev: any) => ({
            ...prev,
            cast: [...prev.cast, { ...editingCast, order: prev.cast.length + 1 }],
        }));
        setEditingCast(null);
        queryClient.invalidateQueries({ queryKey: projectsKeys.cast() });
    };

    const handleDeleteCast = (castIndex: number) => {
        setForm((prev: any) => {
            const nextCast = prev.cast.filter((_: Cast, idx: number) => idx !== castIndex);
            return {
                ...prev,
                cast: nextCast.map((c: Cast, idx: number) => ({ ...c, order: idx + 1 })),
            };
        });
    };

    

    const handleCastDragStart = (index: number) => {
        setDraggedCastIndex(index);
    };

    const handleCastDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleCastDrop = (targetIndex: number) => {
        if (draggedCastIndex === null || draggedCastIndex === targetIndex) {
            setDraggedCastIndex(null);
            return;
        }

        setForm((prev: any) => {
            const nextCast = [...prev.cast];
            const [moved] = nextCast.splice(draggedCastIndex, 1);
            nextCast.splice(targetIndex, 0, moved);
            return {
                ...prev,
                cast: nextCast.map((c: Cast, idx: number) => ({ ...c, order: idx + 1 })),
            };
        });

        setDraggedCastIndex(null);
    };

    const handleCastDragEnd = () => {
        setDraggedCastIndex(null);
    };

    // Main Cover Management
    const handleMainCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await photoUpload.run({
                title: "Uploading photo...",
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    // load image to read natural dimensions
                    const img = new Image();
                    await new Promise<void>((resolve) => {
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                        img.src = dataUrl;
                    });
                    loadedImgRef.current = img;
                    setMainCoverMeta({ width: img.naturalWidth, height: img.naturalHeight });
                    setCroppedPreview(null);
                    setCropCenter({ x: 0.5, y: 0.5 });
                    setZoom(1);
                    setCropEnabled(true);
                    setForm({
                        ...form,
                        mainCover: {
                            url: dataUrl,
                            mimeType: file.type,
                            originalName: file.name,
                            size: file.size,
                        },
                    });
                },
            });
        } catch {
            // ignore
        }
    };

    const handleRemoveMainCover = () => {
        setForm({ ...form, mainCover: null });
        loadedImgRef.current = null;
        setMainCoverMeta(null);
        setCroppedPreview(null);
        setCropEnabled(false);
        setOverlayStyle({});
    };

    const updateOverlayStyle = () => {
        if (!form.mainCover || !displayImgRef.current || !mainCoverMeta) return;
        const imgEl = displayImgRef.current;
        const rect = imgEl.getBoundingClientRect();
        const containerW = rect.width;
        const containerH = rect.height;
        const imgAspect = mainCoverMeta.width / mainCoverMeta.height;
        const containerAspect = containerW / containerH;
        let displayedW: number, displayedH: number, offsetX: number, offsetY: number;
        if (imgAspect > containerAspect) {
            displayedW = containerW;
            displayedH = containerW / imgAspect;
            offsetX = 0;
            offsetY = (containerH - displayedH) / 2;
        } else {
            displayedH = containerH;
            displayedW = containerH * imgAspect;
            offsetX = (containerW - displayedW) / 2;
            offsetY = 0;
        }
        const scale = displayedW / mainCoverMeta.width;
        const naturalW = mainCoverMeta.width;
        const naturalH = mainCoverMeta.height;
        const aspectRatio = 4 / 5;
        let cropNatW: number, cropNatH: number;
        if (naturalW / naturalH > aspectRatio) {
            cropNatH = naturalH / zoom;
            cropNatW = cropNatH * aspectRatio;
        } else {
            cropNatW = naturalW / zoom;
            cropNatH = cropNatW / aspectRatio;
        }
        const cx = clamp(cropCenter.x, 0, 1) * naturalW;
        const cy = clamp(cropCenter.y, 0, 1) * naturalH;
        let sx = cx - cropNatW / 2;
        let sy = cy - cropNatH / 2;
        sx = clamp(sx, 0, naturalW - cropNatW);
        sy = clamp(sy, 0, naturalH - cropNatH);
        const left = offsetX + sx * scale;
        const top = offsetY + sy * scale;
        setOverlayStyle({ left: `${left}px`, top: `${top}px`, width: `${cropNatW * scale}px`, height: `${cropNatH * scale}px` });
    };

    const generateCropPreview = () => {
        if (!form.mainCover || !loadedImgRef.current || !mainCoverMeta) return;
        const img = loadedImgRef.current;
        const naturalW = mainCoverMeta.width;
        const naturalH = mainCoverMeta.height;
        const aspectRatio = 4 / 5;
        let cropNatW: number, cropNatH: number;
        if (naturalW / naturalH > aspectRatio) {
            cropNatH = naturalH / zoom;
            cropNatW = cropNatH * aspectRatio;
        } else {
            cropNatW = naturalW / zoom;
            cropNatH = cropNatW / aspectRatio;
        }
        const cx = clamp(cropCenter.x, 0, 1) * naturalW;
        const cy = clamp(cropCenter.y, 0, 1) * naturalH;
        let sx = Math.round(cx - cropNatW / 2);
        let sy = Math.round(cy - cropNatH / 2);
        sx = Math.max(0, Math.min(sx, Math.round(naturalW - cropNatW)));
        sy = Math.max(0, Math.min(sy, Math.round(naturalH - cropNatH)));

        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        let outW = Math.round(cropNatW);
        let outH = Math.round(cropNatH);
        if (outW > maxSize) { outH = Math.round(outH * maxSize / outW); outW = maxSize; }
        if (outH > maxSize) { outW = Math.round(outW * maxSize / outH); outH = maxSize; }
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
            ctx.drawImage(img, sx, sy, cropNatW, cropNatH, 0, 0, outW, outH);
            const dataUrl = canvas.toDataURL(form.mainCover.mimeType || 'image/jpeg', 0.9);
            setCroppedPreview(dataUrl);
            setForm((prev: any) => ({ ...prev, mainCover: { ...prev.mainCover, croppedUrl: dataUrl, crop: { center: cropCenter, zoom } } }));
        } catch {
            setCroppedPreview(null);
            setForm((prev: any) => ({ ...prev, mainCover: { ...prev.mainCover, croppedUrl: undefined, crop: { center: cropCenter, zoom } } }));
        }
    };

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    const onPointerMoveWindow = (ev: PointerEvent) => {
        if (!isDraggingRef.current || !displayImgRef.current || !mainCoverMeta) return;
        const dx = ev.clientX - dragStartRef.current.x;
        const dy = ev.clientY - dragStartRef.current.y;
        const rect = displayImgRef.current.getBoundingClientRect();
        const imgAspect = mainCoverMeta.width / mainCoverMeta.height;
        const containerAspect = rect.width / rect.height;
        let displayedW: number;
        if (imgAspect > containerAspect) {
            displayedW = rect.width;
        } else {
            displayedW = rect.height * imgAspect;
        }
        const scale = displayedW / mainCoverMeta.width;
        const deltaNaturalX = dx / scale;
        const deltaNaturalY = dy / scale;
        const newCenterX = clamp((dragStartRef.current.center.x * mainCoverMeta.width + deltaNaturalX) / mainCoverMeta.width, 0, 1);
        const newCenterY = clamp((dragStartRef.current.center.y * mainCoverMeta.height + deltaNaturalY) / mainCoverMeta.height, 0, 1);
        setCropCenter({ x: newCenterX, y: newCenterY });
    };

    const onPointerUpWindow = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener('pointermove', onPointerMoveWindow);
        window.removeEventListener('pointerup', onPointerUpWindow);
    };

    const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!cropEnabled || !displayImgRef.current || !mainCoverMeta) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY, center: { ...cropCenter } };
        window.addEventListener('pointermove', onPointerMoveWindow);
        window.addEventListener('pointerup', onPointerUpWindow);
    };

    const handleImageClickToCenter = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!cropEnabled || !displayImgRef.current || !mainCoverMeta || isDraggingRef.current) return;
        const rect = displayImgRef.current.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const scale = rect.width / mainCoverMeta.width;
        const naturalX = px / scale;
        const naturalY = py / scale;
        setCropCenter({ x: clamp(naturalX / mainCoverMeta.width, 0, 1), y: clamp(naturalY / mainCoverMeta.height, 0, 1) });
    };

    useEffect(() => {
        if (cropEnabled) {
            // update overlay and preview when crop values change
            updateOverlayStyle();
            generateCropPreview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cropEnabled, cropCenter.x, cropCenter.y, zoom, mainCoverMeta, form.mainCover]);
const handleDateChange = (date: Date | null) => {
    setForm({ ...form, publishAt: date });
};
const handleShootedAtChange = (date: Date | null) => {
    setForm({ ...form, shootedAt: date });
};
    useEffect(() => {
        const onResize = () => updateOverlayStyle();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mainCoverMeta, form.mainCover, cropCenter, zoom]);

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(form.name?.en && form.name.en.trim()) || !(form.name?.ar && form.name.ar.trim())) {
        alert("English and Arabic project names are required");
        return;
    }

    setSaveStatus("saving");

    try {
        // Preserve File references before deep-clone (JSON.stringify destroys them)
        const fileRefs = new Map<string, File>();
        if (Array.isArray(form.materials)) {
            form.materials.forEach((m: any, mi: number) => {
                if (m?._file) fileRefs.set(`material:${mi}:_file`, m._file);
                if (Array.isArray(m?.items)) {
                    m.items.forEach((it: any, ii: number) => {
                        if (it?._file) fileRefs.set(`material:${mi}:item:${ii}:_file`, it._file);
                    });
                }
            });
        }

        // shallow clone for inspection
        const clone = JSON.parse(JSON.stringify(form));

        // Restore File references onto cloned materials
        if (Array.isArray(clone.materials)) {
            clone.materials.forEach((m: any, mi: number) => {
                const ref = fileRefs.get(`material:${mi}:_file`);
                if (ref) m._file = ref;
                if (Array.isArray(m?.items)) {
                    m.items.forEach((it: any, ii: number) => {
                        const ref = fileRefs.get(`material:${mi}:item:${ii}:_file`);
                        if (ref) it._file = ref;
                    });
                }
            });
        }

        // precompute how many asset uploads we will perform (data-URL based)
        let uploadsCount = 0;
        if (clone.mainCover) {
            const coverSrc = clone.mainCover.croppedUrl || clone.mainCover.url;
            if (isDataUrl(coverSrc)) uploadsCount += 1;
        }

        if (Array.isArray(clone.materials)) {
            clone.materials.forEach((m: any) => {
                if (isPhotoMaterialType(m.type)) {
                    const items = buildPhotoItems(m);
                    items.forEach((it) => {
                        if (isDataUrl(it.url)) uploadsCount += 1;
                    });
                }
                if (m.type === "video" && m.url && isDataUrl(m.url)) uploadsCount += 1;
                const mThumbUrl = typeof m.thumbnail === 'string' ? m.thumbnail : m.thumbnail?.url;
                if (mThumbUrl && isDataUrl(mThumbUrl)) uploadsCount += 1;
                if (m.before?.url && isDataUrl(m.before.url)) uploadsCount += 1;
                if (m.after?.url && isDataUrl(m.after.url)) uploadsCount += 1;
            });
        }

        if (Array.isArray(clone.cast)) {
            clone.cast.forEach((c: any) => {
                const photoUrl = c && (typeof c.photo === "string" ? c.photo : c.photo?.url);
                if (photoUrl && isDataUrl(photoUrl)) uploadsCount += 1;
            });
        }

        const total = uploadsCount + 1; // +1 for final submission step
        setTotalSteps(total);
        setUploadedSteps(0);
        setUploadProgress(0);
        setUploadModalOpen(true);
        const startTime = Date.now();
        setEstimatedSecondsLeft(null);
        setUploadLabel("Uploading assets...");

        let completedSteps = 0;
        const updateProgress = (label?: string) => {
            completedSteps += 1;
            setUploadedSteps(completedSteps);
            const pct = Math.round((completedSteps / total) * 100);
            setUploadProgress(pct);
            if (label) setUploadLabel(label);

            const elapsed = (Date.now() - startTime) / 1000;
            const avg = elapsed / Math.max(1, completedSteps);
            const remaining = Math.max(0, Math.round((total - completedSteps) * avg));
            setEstimatedSecondsLeft(remaining);
        };

        const uploadAssetIfNeeded = async (
            asset: { url?: string; mimeType?: string; size?: number; originalName?: string; _file?: File },
            resourceType: "image" | "video",
            fallbackFileName: string,
        ) => {
            if (!asset?.url || !needsUpload(asset.url)) {
                return asset;
            }

            let uploaded;
            if (asset._file) {
                uploaded = await uploadFileToR2(asset._file, {
                    resourceType,
                    fileName: asset.originalName || fallbackFileName,
                });
            } else {
                uploaded = await uploadThumbnailToR2(asset.url, {
                    resourceType,
                    fileName: asset.originalName || fallbackFileName,
                });
            }

            // count this uploaded step
            updateProgress();

            return {
                ...asset,
                url: uploaded.url,
                mimeType: uploaded.mimeType || asset.mimeType,
                size: uploaded.size || asset.size,
                originalName: uploaded.originalName || asset.originalName || fallbackFileName,
            };
        };

        // upload full main cover (original image before crop)
        if (clone.mainCover) {
            const fullCoverSource = form.mainCover?.url || clone.mainCover.url;
            const uploadedFullCover = await uploadAssetIfNeeded(
                { url: fullCoverSource, mimeType: clone.mainCover.mimeType, originalName: clone.mainCover.originalName, size: clone.mainCover.size },
                "image",
                clone.mainCover.originalName || `full-main-cover-${Date.now()}.jpg`,
            );
            clone.fullMainCover = uploadedFullCover;
        }

        // upload main cover if needed
        if (clone.mainCover) {
            const coverUploadSource = clone.mainCover.croppedUrl || clone.mainCover.url;
            const uploadedMainCover = await uploadAssetIfNeeded(
                { ...clone.mainCover, url: coverUploadSource },
                "image",
                clone.mainCover.originalName || `main-cover-${Date.now()}.jpg`,
            );

            clone.mainCover = {
                ...clone.mainCover,
                ...uploadedMainCover,
                url: uploadedMainCover.url,
            };

            // remove cropping preview data that backend validation may reject
            delete clone.mainCover.croppedUrl;
            delete clone.mainCover.crop;
        }

        // Process materials sequentially to cap total concurrent uploads at 3
        if (Array.isArray(clone.materials)) {
            const processedMaterials: any[] = [];
            for (let materialIndex = 0; materialIndex < clone.materials.length; materialIndex++) {
                const m = clone.materials[materialIndex];
                    const copy: any = { ...m };

                        if (copy.type === "bulk" && isVideoBulkType(copy)) {
                            let normalizedVideoItems = buildVideoItems(copy).map((item) => ({
                                url: item.url,
                                mimeType: item.mimeType,
                                originalName: item.originalName,
                                size: item.size,
                                thumbnail: item.thumbnail,
                                type: "video" as const,
                                _file: (item as any)._file,
                            }));

                            normalizedVideoItems = await runWithConcurrency(
                                normalizedVideoItems, 3,
                                async (item, itemIndex) => {
                                    const uploadedItem = await uploadAssetIfNeeded(
                                        item,
                                        "video",
                                        item.originalName || `project-video-${materialIndex + 1}-${itemIndex + 1}.mp4`,
                                    );
                                    let uploadedThumb = item.thumbnail;
                                    if (item.thumbnail && needsUpload(item.thumbnail)) {
                                        const thumbResult = await uploadThumbnailToR2(item.thumbnail, {
                                            resourceType: "image",
                                            fileName: `video-thumb-${materialIndex + 1}-${itemIndex + 1}.jpg`,
                                        });
                                        uploadedThumb = thumbResult.url;
                                    }
                                    return {
                                        ...item,
                                        ...uploadedItem,
                                        thumbnail: uploadedThumb,
                                        type: "video",
                                    };
                                },
                            );

                            copy.items = normalizedVideoItems;
                            copy.url = normalizedVideoItems[0]?.url || copy.url;
                            copy.mimeType = normalizedVideoItems[0]?.mimeType || copy.mimeType;
                            copy.originalName = normalizedVideoItems[0]?.originalName || copy.originalName;
                            copy.size = normalizedVideoItems[0]?.size || copy.size;
                            copy.type = normalizedVideoItems.length > 1 ? "bulk" : "video";
                        } else if (copy.type === "video" && copy.url) {
                            // Check if material has multiple video items (type was "video" but had bulk items)
                            const videoItems = buildVideoItems(copy);
                            if (videoItems.length > 1) {
                                let normalizedVideoItems = videoItems.map((item) => ({
                                    url: item.url,
                                    mimeType: item.mimeType,
                                    originalName: item.originalName,
                                    size: item.size,
                                    thumbnail: item.thumbnail,
                                    type: "video" as const,
                                    _file: (item as any)._file,
                                }));

                                normalizedVideoItems = await runWithConcurrency(
                                    normalizedVideoItems, 3,
                                    async (item, itemIndex) => {
                                        const uploadedItem = await uploadAssetIfNeeded(
                                            item,
                                            "video",
                                            item.originalName || `project-video-${materialIndex + 1}-${itemIndex + 1}.mp4`,
                                        );
                                        let uploadedThumb = item.thumbnail;
                                        if (item.thumbnail && isDataUrl(item.thumbnail)) {
                                            const thumbResult = await uploadDataUrlToR2Cached(item.thumbnail, {
                                                resourceType: "image",
                                                fileName: `video-thumb-${materialIndex + 1}-${itemIndex + 1}.jpg`,
                                            });
                                            uploadedThumb = thumbResult.url;
                                        }
                                        return {
                                            ...item,
                                            ...uploadedItem,
                                            thumbnail: uploadedThumb,
                                            type: "video",
                                        };
                                    },
                                );

                                copy.items = normalizedVideoItems;
                                copy.url = normalizedVideoItems[0]?.url || copy.url;
                                copy.mimeType = normalizedVideoItems[0]?.mimeType || copy.mimeType;
                                copy.originalName = normalizedVideoItems[0]?.originalName || copy.originalName;
                                copy.size = normalizedVideoItems[0]?.size || copy.size;
                                copy.type = "bulk";
                            } else {
                                const videoFile = buildVideoItems(copy)[0] as any;
                                const uploadedVideo = await uploadAssetIfNeeded(
                                    { ...copy, _file: videoFile?._file },
                                    "video",
                                    copy.originalName || `project-video-${materialIndex + 1}.mp4`,
                                );

                                copy.url = uploadedVideo.url;
                                copy.mimeType = uploadedVideo.mimeType || copy.mimeType;
                                copy.originalName = uploadedVideo.originalName || copy.originalName;
                                copy.size = uploadedVideo.size || copy.size;

                                const thumbAsset = typeof copy.thumbnail === 'string' ? { url: copy.thumbnail } : copy.thumbnail;
                                if (thumbAsset?.url) {
                                    const uploadedThumb = await uploadAssetIfNeeded(
                                        thumbAsset,
                                        "image",
                                        thumbAsset.originalName || `project-video-thumb-${materialIndex + 1}.jpg`,
                                    );
                                    copy.thumbnail = uploadedThumb.url;
                                }
                            }
                    } else if (isPhotoMaterialType(copy.type)) {
                        let normalizedItems = buildPhotoItems(copy).map((item) => ({
                            url: item.url,
                            mimeType: item.mimeType,
                            originalName: item.originalName,
                            size: item.size,
                            type: "photo",
                        }));

                        normalizedItems = await Promise.all(
                            normalizedItems.map(async (item, itemIndex) => {
                                const uploadedItem = await uploadAssetIfNeeded(
                                    item,
                                    "image",
                                    item.originalName || `project-photo-${materialIndex + 1}-${itemIndex + 1}.jpg`,
                                );

                                return {
                                    ...item,
                                    ...uploadedItem,
                                    type: "photo",
                                };
                            }),
                        );

                        copy.url = normalizedItems[0]?.url || copy.url;
                        copy.mimeType = normalizedItems[0]?.mimeType || copy.mimeType;
                        copy.originalName = normalizedItems[0]?.originalName || copy.originalName;
                        copy.size = normalizedItems[0]?.size || copy.size;
                        copy.items = normalizedItems;
                        copy.type = normalizedItems.length > 1 ? "bulk" : "photo";
                    }

                    if (copy.before?.url) {
                        const uploadedBefore = await uploadAssetIfNeeded(
                            copy.before,
                            "image",
                            copy.before.originalName || `before-${materialIndex + 1}.jpg`,
                        );
                        copy.before = { ...copy.before, ...uploadedBefore };
                    }

                    if (copy.after?.url) {
                        const uploadedAfter = await uploadAssetIfNeeded(
                            copy.after,
                            "image",
                            copy.after.originalName || `after-${materialIndex + 1}.jpg`,
                        );
                        copy.after = { ...copy.after, ...uploadedAfter };
                    }

                    if (copy.before) {
                        const { url, label, type } = copy.before;
                        copy.before = { url, label: toLocalizedString(label), type };
                    }
                    if (copy.after) {
                        const { url, label, type } = copy.after;
                        copy.after = { url, label: toLocalizedString(label), type };
                    }

                    if (Array.isArray(copy.items)) {
                        copy.items = copy.items.map((item: any) => {
                            const cleanItem: any = { ...item };
                            delete cleanItem._id;
                            delete cleanItem._file;
                            cleanItem.caption = cleanItem.caption ? toLocalizedString(cleanItem.caption) : undefined;
                            cleanItem.before = cleanItem.before ? localizeSideLabel(cleanItem.before) : cleanItem.before;
                            cleanItem.after = cleanItem.after ? localizeSideLabel(cleanItem.after) : cleanItem.after;
                            return cleanItem;
                        });
                    }

                    if (copy._file) delete copy._file;

                    if (copy.caption) copy.caption = toLocalizedString(copy.caption);
                    if (copy.textContent) copy.textContent = toLocalizedString(copy.textContent);
                    if (copy.htmlContent) copy.htmlContent = toLocalizedString(copy.htmlContent);

                    processedMaterials.push(copy);
            }
            clone.materials = processedMaterials;

            clone.materials = clone.materials.map((material: any, index: number) => {
                if (!material) return { order: index + 1 };

                const getThumbUrl = (thumb: any) => {
                    if (!thumb) return undefined;
                    if (typeof thumb === 'string') return thumb;
                    if (typeof thumb === 'object') return thumb.url || thumb.publicId || undefined;
                    return undefined;
                };

                // Keep `items` only for bulk materials; strip for others
                if (material.type === "bulk") {
                    return {
                        ...material,
                        items: Array.isArray(material.items) ? material.items : [],
                        thumbnail: getThumbUrl(material.thumbnail),
                        order: index + 1,
                    };
                }

                const { items, thumbnail, ...rest } = material || {};
                return {
                    ...rest,
                    thumbnail: getThumbUrl(thumbnail),
                    order: index + 1,
                };
            });
        }

        // Prepare cast for submission: pre-create new members via API, then send castId (string) + order
        if (Array.isArray(clone.cast)) {
            const processedCast: any[] = [];
            for (let ci = 0; ci < clone.cast.length; ci++) {
                const c = clone.cast[ci];
                    if (!c) { processedCast.push(c); continue; }
                    if (typeof c === "string") { processedCast.push({ castId: c }); continue; }

                    const socialLinks = (c.socialLinks || [])
                        .filter((l: any) => l && (l.platform || "").trim() && (l.url || "").trim())
                        .map((l: any) => ({ platform: (l.platform || "").trim(), url: (l.url || "").trim() }));

                    let photo: any = c.photo || null;
                    let photoUrl = typeof photo === "string" ? photo : photo?.url;
                    if (photoUrl && isDataUrl(photoUrl)) {
                        const uploaded = await uploadDataUrlToR2(photoUrl, {
                            resourceType: "image",
                            fileName: (photo && photo.originalName) || `cast-photo-${Date.now()}.jpg`,
                        });
                        updateProgress();
                        photo = uploaded.url;
                    } else if (photo && typeof photo === "object" && !photoUrl && photo.publicId) {
                        photo = photo.publicId;
                    } else {
                        photo = photoUrl || null;
                    }

                    // Existing member — send its Cast id via castId
                    if ((c.__existing || c._id || c.id) && (c._id || c.id)) {
                        processedCast.push({ castId: c._id || c.id, order: Number(c.order) || 0 });
                        continue;
                    }

                    // New member — pre-create via API, then use returned _id as castId
                    const created = await createCast({
                        name: c.name || "",
                        title: c.title || "",
                        photo: photo || undefined,
                        socialLinks: socialLinks.length ? socialLinks : undefined,
                    });
                    processedCast.push({ castId: created._id, order: Number(c.order) || 0 });
            }
            clone.cast = processedCast;
        }

        const submitData = {
            name: toLocalizedString(clone.name),
            description: toLocalizedString(clone.description),
            location: toLocalizedString(clone.location),
            order: clone.order,
            published: clone.published,
            publishedAt: clone.publishAt ? new Date(clone.publishAt).toISOString() : undefined,
            shootedAt: clone.shootedAt ? new Date(clone.shootedAt).toISOString() : undefined,
            categories: await resolveTaxonomyIds(clone.categories, "category"),
            tags: normalizeArrayField(clone.tags),
            types: await resolveTaxonomyIds(clone.types, "type"),
            material: clone.materials,
            cast: clone.cast,
            mainCover: clone.mainCover,
            fullMainCover: clone.fullMainCover,
            parentProject: getOptionValue(clone.parentProject) || undefined,
            company: getOptionValue(clone.company) || undefined,
        };

        // final submission step (use mutateAsync to await completion and update progress)
        setUploadLabel("Submitting project...");
        const created = await mutation.mutateAsync(submitData as any);

        // mark final step complete
        updateProgress();

        setSaveStatus("success");
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => {
            // close modal and navigate to created project if available
            setUploadModalOpen(false);
            const projectId = created?.id;
            navigate(projectId ? `/projects/${projectId}` : "/projects");
        }, 900);
    } catch (error: any) {
        console.error("Project submission failed:", error);
        setSaveStatus("error");
        setUploadModalOpen(false);
        showAlert(extractBackendError(error), "error");
        setTimeout(() => setSaveStatus("idle"), 3000);
    }
};

    const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== "Enter") return;

        // don't intercept when editing a material or cast modal is open
        if (editingMaterial || editingCast) return;

        const target = e.target as HTMLElement | null;
        // allow Enter inside textareas, contenteditable elements, or fields that add values on Enter
        if (target && (target.tagName === "TEXTAREA" || target.getAttribute?.("contenteditable") === "true" || target.hasAttribute?.("data-enter-add") || target.closest?.(".MuiAutocomplete-root"))) {
            return;
        }

        e.preventDefault();

        const order: Array<"basic" | "materials" | "cast" | "media"> = ["basic", "materials", "cast", "media"];
        const idx = order.indexOf(activeTab);
        if (idx === -1) return;

        if (idx < order.length - 1) {
            setActiveTab(order[idx + 1]);
        } else {
            // on final step — do nothing (prevent form submit)
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes) return "N/A";
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatRichText = (content?: string) => {
        if (!content) return "";
        return /<\/?[a-z][\s\S]*>/i.test(content) ? content : content.replace(/\n/g, "<br />");
    };

    const formatTimeShort = (secs: number) => {
        const s = Math.max(0, Math.round(secs || 0));
        if (s === 0) return "0s";
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}m ${r}s`;
    };

    const isSaving = mutation.isPending || saveStatus === "saving";

    return (
        <div className="min-h-screen bg-light-50 dark:bg-dark-950">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="relative rounded-2xl bg-light-50/5 dark:bg-dark-950/70 border border-light-100 dark:border-dark-800 p-6 lg:p-8 shadow-xl overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Link to="/projects" className="text-light-500 dark:text-secdark-500 hover:text-light-600 dark:hover:text-secdark-400 transition-colors">
                                        <ArrowLeft className="w-5 h-5" />
                                    </Link>
                                        <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-wider text-light-400 dark:text-dark-300">
                                         {tr("create_new", "Create New")}
                                     </span>
                                </div>
                                <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-light-900 dark:text-dark-50 leading-tight">
                                    {tr("add_new_project", "Add New Project")}
                                </h1>
                                <p className="mt-2 text-sm text-light-600 dark:text-dark-400 max-w-2xl">
                                    {tr("create_project_subtitle", "Create a new project with complete details including materials, team members, and media")}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Link to="/projects" className="btn-ghost inline-flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                    {tr("back", "Back")}
                                </Link>
                                <button type="button" onClick={handleResetProject} className="btn-ghost inline-flex items-center gap-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/30">
                                    <Trash2 className="w-4 h-4" />
                                    {tr("reset_project", "Reset Project")}
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("videos_count", "Videos")}</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">
                                    {form.materials.reduce((count: number, m: Material) => {
                                        if (m.type === "video") return count + 1;
                                        if (m.type === "bulk" && isVideoBulkType(m)) return count + buildVideoItems(m).length;
                                        return count;
                                    }, 0)}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("photos_count", "Photos")}</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">
            {form.materials.reduce((count: number, m: Material) => {
                if (m.type === "video") return count + 1;
                if (m.type === "bulk" && isVideoBulkType(m)) return count + buildVideoItems(m).length;
                return count + buildPhotoItems(m).length;
            }, 0)}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">BTS</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">
                                    {form.materials.filter((m: Material) => {
                                        const caption = localizedToString(m.caption) || "";
                                        return caption.toLowerCase().includes("bts");
                                    }).length}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("team_members_count", "Team Members")}</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.cast.length}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">{tr("categories_label", "Sectors")}</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.categories.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-2 border-b border-light-200 dark:border-dark-800 mb-6">
                    <button
                        onClick={() => setActiveTab("basic")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "basic"
                                ? "text-light-500 dark:text-secdark-500 border-b-2 border-light-500 dark:border-secdark-500"
                                : "text-light-600 dark:text-dark-400 hover:text-light-700 dark:hover:text-dark-300"
                        }`}
                    >
                        <Info className="w-4 h-4 inline mr-2" />
                        {tr("basic_info", "Basic Info")}
                    </button>
                    <button
                        onClick={() => setActiveTab("materials")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "materials"
                                ? "text-light-500 dark:text-secdark-500 border-b-2 border-light-500 dark:border-secdark-500"
                                : "text-light-600 dark:text-dark-400 hover:text-light-700 dark:hover:text-dark-300"
                        }`}
                    >
                        <Layers className="w-4 h-4 inline mr-2" />
                        {tr("materials_count", "Materials")} ({form.materials.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("cast")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "cast"
                                ? "text-light-500 dark:text-secdark-500 border-b-2 border-light-500 dark:border-secdark-500"
                                : "text-light-600 dark:text-dark-400 hover:text-light-700 dark:hover:text-dark-300"
                        }`}
                    >
                        <Users className="w-4 h-4 inline mr-2" />
                        {tr("cast_and_crew", "Cast & Crew")} ({form.cast.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("media")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "media"
                                ? "text-light-500 dark:text-secdark-500 border-b-2 border-light-500 dark:border-secdark-500"
                                : "text-light-600 dark:text-dark-400 hover:text-light-700 dark:hover:text-dark-300"
                        }`}
                    >
                        <Camera className="w-4 h-4 inline mr-2" />
                        {tr("main_cover", "Main Cover")}
                    </button>
                </div>
            </div>

            {/* Form Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <form onKeyDown={handleFormKeyDown}>
                    {/* Basic Information Tab */}
{activeTab === "basic" && (
    <div className="space-y-6">
        <div className="card p-6">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("clone_from_existing", "Clone from Existing Project")}</h2>
                <Copy className="w-5 h-5 text-light-400 dark:text-dark-500" />
            </div>
            <p className="text-sm text-light-600 dark:text-dark-400 mb-4">
                {tr("clone_description", "Select an existing project to copy all of its data into this form. Materials are not copied.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <select
                    value={cloneProjectId}
                    onChange={(e) => setCloneProjectId(e.target.value)}
                    className="input w-full"
                >
                    <option value="">{tr("select_project_to_clone", "Select a project to clone...")}</option>
                    {allProjects.map((p: any) => (
                        <option key={p._id || p.id || getOptionLabel(p)} value={p._id || p.id}>
                            {getOptionLabel(p)}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={resetCloneSelection}
                    disabled={!cloneProjectId}
                    className="btn-ghost inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                    {tr("clear", "Clear")}
                </button>
            </div>
            {cloneSourceProject && (
                <div className="mt-3 flex items-center gap-2 text-sm text-danger-500 dark:text-danger-400">
                    <CheckCircle className="w-4 h-4" />
                    {tr("cloned_from", "Cloned from")} &quot;{getOptionLabel(cloneSourceProject)}&quot; — {tr("materials_not_copied", "materials and main cover were not copied.")}
                </div>
            )}
        </div>
        <div className="card p-6">
            <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">{tr("basic_information", "Basic Information")}</h2>
            <div className="space-y-4">
                <div>
                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("project_name_en", "Project Name (English) *")}
                    </label>
                    <input
                        type="text"
                        value={form.name?.en || ""}
                        onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })}
                        required
                        className="input w-full"
                        placeholder={tr("enter_project_name_en", "Enter project name (English)")}
                    />
                    <div className="mt-1.5">
                        <TranslateButton onClick={nameEnToAr.translate} isTranslating={nameEnToAr.isTranslating} disabled={!form.name?.en?.trim()} />
                    </div>
                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("project_name_ar", "Project Name (Arabic) *")}
                    </label>
                    <input
                        type="text"
                        dir="rtl"
                        value={form.name?.ar || ""}
                        onChange={(e) => setForm({ ...form, name: { ...form.name, ar: e.target.value } })}
                        required
                        className="input w-full"
                        placeholder="أدخل اسم المشروع (بالعربية)"
                    />
                    <div className="mt-1.5">
                        <TranslateButton onClick={nameArToEn.translate} isTranslating={nameArToEn.isTranslating} disabled={!form.name?.ar?.trim()} label="Translate to EN" />
                    </div>
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("description_en", "Description (English)")}
                    </label>
                    <textarea
                        value={form.description?.en || ""}
                        onChange={(e) => setForm({ ...form, description: { ...form.description, en: e.target.value } })}
                        rows={4}
                        className="input w-full resize-y min-h-[100px]"
                        placeholder={tr("describe_project_en", "Describe the project... (English)")}
                    />
                    <div className="mt-1.5">
                        <TranslateButton onClick={descEnToAr.translate} isTranslating={descEnToAr.isTranslating} disabled={!form.description?.en?.trim()} />
                    </div>
                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("description_ar", "Description (Arabic)")}
                    </label>
                    <textarea
                        dir="rtl"
                        value={form.description?.ar || ""}
                        onChange={(e) => setForm({ ...form, description: { ...form.description, ar: e.target.value } })}
                        rows={4}
                        className="input w-full resize-y min-h-[100px]"
                        placeholder="وصف المشروع (بالعربية)"
                    />
                    <div className="mt-1.5">
                        <TranslateButton onClick={descArToEn.translate} isTranslating={descArToEn.isTranslating} disabled={!form.description?.ar?.trim()} label="Translate to EN" />
                    </div>
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("location_en", "Location (English)")}
                    </label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500" />
                        <input
                            type="text"
                            value={form.location?.en || ""}
                            onChange={(e) => setForm({ ...form, location: { ...form.location, en: e.target.value } })}
                            className="input w-full pl-9"
                            placeholder={tr("location_placeholder", "e.g., Cairo, Egypt")}
                        />
                    </div>
                    <div className="mt-1.5">
                        <TranslateButton onClick={locEnToAr.translate} isTranslating={locEnToAr.isTranslating} disabled={!form.location?.en?.trim()} />
                    </div>
                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("location_ar", "Location (Arabic)")}
                    </label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500" />
                        <input
                            type="text"
                            dir="rtl"
                            value={form.location?.ar || ""}
                            onChange={(e) => setForm({ ...form, location: { ...form.location, ar: e.target.value } })}
                            className="input w-full pl-9"
                            placeholder="مثال: القاهرة، مصر"
                        />
                    </div>
                    <div className="mt-1.5">
                        <TranslateButton onClick={locArToEn.translate} isTranslating={locArToEn.isTranslating} disabled={!form.location?.ar?.trim()} label="Translate to EN" />
                    </div>
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("parent_project", "Parent Project")}
                    </label>
                    <Autocomplete
                        options={allProjects}
                        value={form.parentProject || null}
                        onChange={(_, v) => setForm({ ...form, parentProject: v })}
                        getOptionLabel={(opt) => getOptionLabel(opt)}
                        isOptionEqualToValue={(o: any, v: any) => {
                            const oId = (o && (o._id || o.id)) || "";
                            const vId = (v && (v._id || v.id)) || "";
                            if (oId && vId) return String(oId) === String(vId);
                            return getOptionLabel(o) === getOptionLabel(v);
                        }}
                        renderInput={(params) => <TextField {...params} placeholder={tr("optional_parent_project", "Optional parent project")} size="small" />}
                        sx={taxonomyAutocompleteSx}
                        slotProps={taxonomyAutocompleteSlotProps}
                    />
                </div>

<div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            name="published"
                            id="published"
                            checked={form.published}
                            onChange={handleChange}
                            className="w-4 h-4 rounded border-light-300 dark:border-dark-600 text-light-500 dark:text-secdark-500 focus:ring-light-500 dark:focus:ring-secdark-500"
                        />
                        <label htmlFor="published" className="text-sm text-light-700 dark:text-dark-300">
                            {tr("schedule_publish", "Schedule for publishing (if unchecked, project will be published immediately)")}
                        </label>
                    </div>
                    
                    {form.published && (
                        <div className="ml-7 mt-2">
                            <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                {tr("publish_date_time", "Publish Date & Time")}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500 z-10" />
                                <DatePicker
                                    selected={form.publishAt}
                                    onChange={handleDateChange}
                                    showTimeSelect
                                    dateFormat="MMMM d, yyyy h:mm aa"
                                    placeholderText={tr("select_datetime", "Select date and time to publish")}
                                    minDate={new Date()}
                                    className="input w-full pl-10"
                                    timeIntervals={15}
                                    timeCaption={tr("time_label", "Time")}
                                    calendarClassName="dark:bg-dark-800 dark:text-dark-50"
                                    popperClassName="z-50"
                                />
                            </div>
                            <p className="mt-1 text-xs text-light-500 dark:text-dark-400">
                                {tr("auto_publish_note", "The project will be automatically published at the selected date and time")}
                            </p>
                        </div>
                    )}

                    <div className="mt-3">
                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("shoot_date", "Shoot Date")}
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500 z-10" />
                            <DatePicker
                                selected={form.shootedAt}
                                onChange={handleShootedAtChange}
                                dateFormat="MMMM d, yyyy"
                                placeholderText={tr("select_shoot_date", "Select the shoot date")}
                                className="input w-full pl-10"
                                calendarClassName="!bg-white dark:!bg-dark-800 !border-light-200 dark:!border-dark-600 !rounded-lg shadow-lg"
                                dayClassName={(date) =>
                                    date.toDateString() === new Date().toDateString()
                                        ? "!bg-primary-500 !text-white !rounded-full"
                                        : "!text-light-700 dark:!text-dark-200 hover:!bg-light-100 dark:hover:!bg-dark-700 !rounded-full"
                                }
                                popperClassName="!z-50"
                                wrapperClassName="w-full"
                            />
                        </div>
                        <p className="mt-1 text-xs text-light-500 dark:text-dark-400">
                            {tr("shoot_date_note", "The date when the project was shot or will be shot")}
                        </p>
                    </div>
                </div>
            </div>
        </div>

                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">{tr("categories_and_tags", "Sectors & Tags")}</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("project_company", "Project Company")}
                                        </label>
                                        <Autocomplete
                                            options={projectCompanies}
                                            value={form.company || null}
                                            onChange={(_, v) => setForm({ ...form, company: v })}
                                            getOptionLabel={(opt) => getCompanyLabel(opt)}
                                            isOptionEqualToValue={(o: any, v: any) => {
                                                const oId = (o && (o._id || o.id)) || "";
                                                const vId = (v && (v._id || v.id)) || "";
                                                if (oId && vId) return String(oId) === String(vId);
                                                return getCompanyLabel(o) === getCompanyLabel(v);
                                            }}
                                            renderInput={(params) => <TextField {...params} placeholder={tr("select_company", "Select project company")} size="small" />}
                                            sx={taxonomyAutocompleteSx}
                                            slotProps={taxonomyAutocompleteSlotProps}
                                        />

                                        <div className="mt-4 border-t border-light-200 dark:border-dark-700 pt-4">
                                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-light-500 dark:text-dark-400">
                                                {tr("or_create_company", "Or create a new company")}
                                            </p>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={newCompanyEn}
                                                        onChange={(e) => setNewCompanyEn(e.target.value)}
                                                        className="input w-full"
                                                        placeholder={tr("company_name_en", "Company name (EN)...")}
                                                    />
                                                    <div className="mt-1">
                                                        <TranslateButton onClick={companyEnToAr.translate} isTranslating={companyEnToAr.isTranslating} disabled={!newCompanyEn.trim()} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <input
                                                        type="text"
                                                        dir="rtl"
                                                        value={newCompanyAr}
                                                        onChange={(e) => setNewCompanyAr(e.target.value)}
                                                        className="input w-full"
                                                        placeholder={tr("company_name_ar", "Company name (AR)...")}
                                                    />
                                                    <div className="mt-1">
                                                        <TranslateButton onClick={companyArToEn.translate} isTranslating={companyArToEn.isTranslating} disabled={!newCompanyAr.trim()} label="Translate to EN" />
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={newCompanyField}
                                                    onChange={(e) => setNewCompanyField(e.target.value)}
                                                    className="input w-full"
                                                    placeholder={tr("company_field", "Field (e.g. Production)...")}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleCompanyLogoSelect}
                                                        className="input w-full flex-1"
                                                    />
                                                    {newCompanyLogo && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewCompanyLogo("")}
                                                            className="btn-ghost text-xs shrink-0"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-3">
                                                {newCompanyLogo && (
                                                    <img
                                                        src={newCompanyLogo}
                                                        alt={tr("company_logo_alt", "Company logo")}
                                                        className="h-10 w-10 rounded-lg border border-light-200 object-cover dark:border-dark-700"
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleAddCompany}
                                                    disabled={createCompanyMutation.isPending}
                                                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {createCompanyMutation.isPending ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Plus size={14} />
                                                    )}
                                                    {tr("add_company", "Add Company")}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("categories_label", "Sectors")}
                                        </label>
                                        <p className="text-xs text-light-400 dark:text-dark-500 mt-1">{tr("categories_hint", "The field or industry that the project or client belongs to")}</p>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {form.categories.map((cat: any, idx: number) => (
                                                <span key={getOptionValue(cat) || `${getOptionLabel(cat)}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300 rounded-md text-sm">
                                                    #{getOptionLabel(cat)}
                                                    {cat && typeof cat === "object" && cat.ar && cat.ar.trim() ? (
                                                        <span className="opacity-70"> / #{cat.ar}</span>
                                                    ) : null}
                                                    <button type="button" onClick={() => handleRemoveCategory(cat)} className="hover:text-light-500 dark:hover:text-secdark-500">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <select
                                            value={selectedExistingCategory}
                                            onChange={(e) => {
                                                handleSelectExistingCategory(e.target.value);
                                                setSelectedExistingCategory("");
                                            }}
                                            className="input w-full mb-2"
                                        >
                                            <option value="">{tr("select_existing_category", "Select existing sector...")}</option>
                                            {projectCategoriesLoading ? (
                                                <option value="" disabled>{tr("loading_categories", "Loading sectors...")}</option>
                                            ) : (
                                                projectCategories.map((c: any, idx: number) => (
                                                    <option key={idx} value={idx}>{getOptionLabel(c)}</option>
                                                ))
                                            )}
                                        </select>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={newCategory}
                                                    onChange={(e) => setNewCategory(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_category_en", "Add the sector (EN)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={catEnToAr.translate} isTranslating={catEnToAr.isTranslating} disabled={!newCategory.trim()} />
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={newCategoryAr}
                                                    onChange={(e) => setNewCategoryAr(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_category_ar", "Add the sector (AR)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={catArToEn.translate} isTranslating={catArToEn.isTranslating} disabled={!newCategoryAr.trim()} label="Translate to EN" />
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleAddCategory} className="btn-secondary">{tr("add", "Add")}</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("tags_label", "Tags")}</label>
                                        <p className="text-xs text-light-400 dark:text-dark-500 mt-1">{tr("tags_hint", "Keywords related to the project that make it easier to search")}</p>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {form.tags.map((tag: any, idx: number) => (
                                                <span key={getOptionValue(tag) || `${getOptionLabel(tag)}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300 rounded-md text-sm">
                                                    #{getOptionLabel(tag)}
                                                    {tag && typeof tag === "object" && tag.ar && tag.ar.trim() ? (
                                                        <span className="opacity-70"> / #{tag.ar}</span>
                                                    ) : null}
                                                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-light-500 dark:hover:text-secdark-500">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <Autocomplete
                                            options={existingTags}
                                            getOptionLabel={(opt) => opt.ar ? `${opt.en} / ${opt.ar}` : opt.en}
                                            isOptionEqualToValue={(opt, val) => opt.en === val.en}
                                            value={null}
                                            onChange={(_e, val) => {
                                                if (val) handleSelectExistingTag(val.en);
                                            }}
                                            renderInput={(params) => (
                                                <TextField {...params} placeholder={tr("select_existing_tag", "Search existing tags...")} size="small" />
                                            )}
                                            sx={taxonomyAutocompleteSx}
                                            slotProps={taxonomyAutocompleteSlotProps}
                                            size="small"
                                            className="mb-2"
                                        />
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={newTag}
                                                    onChange={(e) => setNewTag(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_tag_en", "Add a tag (EN)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={tagEnToAr.translate} isTranslating={tagEnToAr.isTranslating} disabled={!newTag.trim()} />
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={newTagAr}
                                                    onChange={(e) => setNewTagAr(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_tag_ar", "Add the tag (AR)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={tagArToEn.translate} isTranslating={tagArToEn.isTranslating} disabled={!newTagAr.trim()} label="Translate to EN" />
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleAddTag} className="btn-secondary">{tr("add", "Add")}</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("project_types", "Project Types")}</label>
                                        <p className="text-xs text-light-400 dark:text-dark-500 mt-1">{tr("types_hint", "The technical terms that describe the work done in the project")}</p>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {form.types.map((type: any, idx: number) => (
                                                <span key={getOptionValue(type) || `${getOptionLabel(type)}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300 rounded-md text-sm">
                                                    #{getOptionLabel(type)}
                                                    {type && typeof type === "object" && type.ar && type.ar.trim() ? (
                                                        <span className="opacity-70"> / #{type.ar}</span>
                                                    ) : null}
                                                    <button type="button" onClick={() => handleRemoveType(type)} className="hover:text-light-500 dark:hover:text-secdark-500">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <select
                                            value={selectedExistingType}
                                            onChange={(e) => {
                                                handleSelectExistingType(e.target.value);
                                                setSelectedExistingType("");
                                            }}
                                            className="input w-full mb-2"
                                        >
                                            <option value="">{tr("select_existing_type", "Select existing type...")}</option>
                                            {projectTypesLoading ? (
                                                <option value="" disabled>{tr("loading_types", "Loading types...")}</option>
                                            ) : (
                                                projectTypes.map((t: any, idx: number) => (
                                                    <option key={idx} value={idx}>{getOptionLabel(t)}</option>
                                                ))
                                            )}
                                        </select>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={newType}
                                                    onChange={(e) => setNewType(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddType())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_type_en", "Add the type (EN)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={typeEnToAr.translate} isTranslating={typeEnToAr.isTranslating} disabled={!newType.trim()} />
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={newTypeAr}
                                                    onChange={(e) => setNewTypeAr(e.target.value)}
                                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddType())}
                                                    data-enter-add
                                                    className="input w-full"
                                                    placeholder={tr("add_type_ar", "Add the type (AR)...")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={typeArToEn.translate} isTranslating={typeArToEn.isTranslating} disabled={!newTypeAr.trim()} label="Translate to EN" />
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleAddType} className="btn-secondary">{tr("add", "Add")}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Materials Tab */}
                    {activeTab === "materials" && (
                        <div className="space-y-6">
                            <div className="card p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("materials_and_media", "Materials & Media")}</h2>
                                    <button type="button" onClick={handleAddMaterial} className="btn-primary inline-flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        {tr("add_material", "Add Material")}
                                    </button>
                                </div>

                                <Reorder.Group axis="y" values={form.materials} onReorder={handleMaterialsReorder} className="space-y-3">
                                    <AnimatePresence initial={false}>
                                        {form.materials.map((material: Material, idx: number) => (
                                            <Reorder.Item
                                                key={material._id || `material-${idx}`}
                                                value={material}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.2, ease: "easeOut" }}
                                                className="border border-light-200 dark:border-dark-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                                                whileDrag={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0,0,0,0.15)", zIndex: 50 }}
                                            >
                                            <div className="w-full grid grid-cols-12 gap-4 items-start">
                                                <div className="col-span-12 sm:col-span-1 flex sm:justify-center">
                                                    <span className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 text-light-500 dark:text-dark-400 cursor-grab active:cursor-grabbing"
                                                         title={tr("drag_to_reorder", "Drag to reorder")}
                                                         aria-label={tr("drag_material_to_reorder", "Drag material to reorder")}
                                                    >
                                                        <GripVertical className="w-4 h-4" />
                                                    </span>
                                                </div>

                                                <div className="col-span-12 sm:col-span-2">
                                                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/5">
                                                        {material.type === "before_after" ? (
                                                            <BeforeAfterSlider
                                                                beforeUrl={material.before?.url}
                                                                afterUrl={material.after?.url}
                                                                beforeLabel={localizedToString(material.before?.label) || tr("before_label", "Before")}
                                                                afterLabel={localizedToString(material.after?.label) || tr("after_label", "After")}
                                                                className="w-full h-full"
                                                                mediaClassName="w-full h-full"
                                                                showSlider={false}
                                                            />
                                                        ) : material.type === "photo" ? (
                                                            (() => {
                                                                const previewItems = buildPhotoItems(material);

                                                                if (!previewItems.length) {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                            <ImageIcon className="w-6 h-6 opacity-40" />
                                                                        </div>
                                                                    );
                                                                }

                                                                if (previewItems.length === 1) {
                                                                    return <img src={previewItems[0].url} alt={localizedToString(material.caption)} className="w-full h-full object-cover" />;
                                                                }

                                                                return (
                                                                    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                                                                        {previewItems.slice(0, 4).map((item, itemIdx) => (
                                                                            <div key={`preview-${item.originalName || itemIdx}`} className="relative w-full h-full">
                                                                                <img src={item.url} alt={localizedToString(material.caption) || `Photo ${itemIdx + 1}`} className="w-full h-full object-cover" />
                                                                                {itemIdx === 3 && previewItems.length > 4 && (
                                                                                    <div className="absolute inset-0 bg-black/45 text-white text-xs font-medium flex items-center justify-center">
                                                                                        +{previewItems.length - 4}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : material.type === "bulk" && isVideoBulkType(material) ? (
                                                            (() => {
                                                                const videoItems = buildVideoItems(material);
                                                                if (!videoItems.length) {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                            <Video className="w-6 h-6 opacity-40" />
                                                                        </div>
                                                                    );
                                                                }
                                                                if (videoItems.length === 1) {
                                                                    return videoItems[0].thumbnail
                                                                        ? <img src={videoItems[0].thumbnail} alt={localizedToString(material.caption) || ''} className="w-full h-full object-cover" />
                                                                        : <video src={videoItems[0].url} className="w-full h-full object-cover" muted preload="metadata" />;
                                                                }
                                                                return (
                                                                    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                                                                        {videoItems.slice(0, 4).map((item, itemIdx) => (
                                                                            <div key={`preview-${item.originalName || itemIdx}`} className="relative w-full h-full">
                                                                                {item.thumbnail ? (
                                                                                    <img src={item.thumbnail} alt={item.originalName || `Video ${itemIdx + 1}`} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                                                                                )}
                                                                                {itemIdx === 3 && videoItems.length > 4 && (
                                                                                    <div className="absolute inset-0 bg-black/45 text-white text-xs font-medium flex items-center justify-center">
                                                                                        +{videoItems.length - 4}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : material.type === "bulk" ? (
                                                            (() => {
                                                                const photoItems = buildPhotoItems(material);
                                                                if (!photoItems.length) {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                            <ImageIcon className="w-6 h-6 opacity-40" />
                                                                        </div>
                                                                    );
                                                                }
                                                                if (photoItems.length === 1) {
                                                                    return <img src={photoItems[0].url} alt={localizedToString(material.caption) || ''} className="w-full h-full object-cover" />;
                                                                }
                                                                return (
                                                                    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                                                                        {photoItems.slice(0, 4).map((item, itemIdx) => (
                                                                            <div key={`preview-${item.originalName || itemIdx}`} className="relative w-full h-full">
                                                                                <img src={item.url} alt={localizedToString(material.caption) || `Photo ${itemIdx + 1}`} className="w-full h-full object-cover" />
                                                                                {itemIdx === 3 && photoItems.length > 4 && (
                                                                                    <div className="absolute inset-0 bg-black/45 text-white text-xs font-medium flex items-center justify-center">
                                                                                        +{photoItems.length - 4}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : material.type === "video" && material.url ? (
                                                                (() => {
                                                                    const allVideoItems = buildVideoItems(material);
                                                                    if (allVideoItems.length > 1) {
                                                                    return (
                                                                        <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                                                                            {allVideoItems.slice(0, 4).map((item, itemIdx) => (
                                                                                <div key={`preview-${item.originalName || itemIdx}`} className="relative w-full h-full">
                                                                                    {item.thumbnail ? (
                                                                                        <img src={item.thumbnail} alt={item.originalName || `Video ${itemIdx + 1}`} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                                                                                    )}
                                                                                    {itemIdx === 3 && allVideoItems.length > 4 && (
                                                                                        <div className="absolute inset-0 bg-black/45 text-white text-xs font-medium flex items-center justify-center">
                                                                                            +{allVideoItems.length - 4}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                    }
                                                                    return <video src={material.url} controls className="w-full h-full object-cover" />;
                                                                })()
                                                        ) : material.type === "text" ? (
                                                            <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                <FileText className="w-6 h-6 opacity-40" />
                                                            </div>
                                                        ) : material.type === "html" ? (
                                                            <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                <Code className="w-6 h-6 opacity-40" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-light-400 dark:text-dark-500">
                                                                <ImageIcon className="w-6 h-6 opacity-40" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="col-span-12 sm:col-span-7">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {material.type === "photo" && <ImageIcon className="w-4 h-4 text-light-500" />}
                                                        {material.type === "video" && <Video className="w-4 h-4 text-light-500" />}
                                                        {material.type === "bulk" && isVideoBulkType(material) && <Video className="w-4 h-4 text-light-500" />}
                                                        {material.type === "bulk" && !isVideoBulkType(material) && <ImageIcon className="w-4 h-4 text-light-500" />}
                                                        {material.type === "before_after" && <Camera className="w-4 h-4 text-light-500" />}
                                                        {material.type === "text" && <FileText className="w-4 h-4 text-light-500" />}
                                                        {material.type === "html" && <Code className="w-4 h-4 text-light-500" />}
                                                        <span className="text-sm font-medium text-light-900 dark:text-dark-50">
                                                            {(() => {
                                                                if (material.type === "video") {
                                                                    const videoCount = buildVideoItems(material).length;
                                                                    return videoCount > 1
                                                                        ? `${videoCount} ${tr("videos", "videos")} #${material.order}`
                                                                        : `VIDEO #${material.order}`;
                                                                }
                                                                if (material.type === "bulk" && isVideoBulkType(material)) {
                                                                    const videoCount = buildVideoItems(material).length;
                                                                    return `${videoCount} ${tr("videos", "videos")} #${material.order}`;
                                                                }
                                                                return `${material.type.toUpperCase()} #${material.order}`;
                                                            })()}
                                                        </span>
                                                        {localizedToString(material.caption) && (
                                                            <span className="text-xs text-light-500 dark:text-secdark-500">{localizedToString(material.caption)}</span>
                                                        )}
                                                    </div>

                                                    {(material.type === "photo" || isPhotoMaterialType(material.type)) && (() => {
                                                        const photoItems = buildPhotoItems(material);
                                                        const primarySize = photoItems[0]?.size || material.size;
                                                        return (
                                                            <div className="mt-2 text-xs text-light-500 dark:text-dark-400">
                                                                {photoItems.length > 0
                                                                    ? `${photoItems.length} ${photoItems.length === 1 ? tr("photo", "photo") : tr("photos", "photos")} ${tr("grouped", "grouped")}`
                                                                    : (material.originalName ? `${tr("file_label", "File:")} ${material.originalName}` : tr("uploaded_image", "Uploaded image"))}
                                                                {primarySize ? ` • ${formatBytes(primarySize || 0)}` : ""}
                                                            </div>
                                                        );
                                                    })()}

                                                    {((material.type === "video") || (material.type === "bulk" && isVideoBulkType(material))) && (() => {
                                                        const videoItems = buildVideoItems(material);
                                                        return (
                                                            <div className="mt-2 text-xs text-light-500 dark:text-dark-400">
                                                                {videoItems.length > 1
                                                                    ? `${videoItems.length} ${tr("videos", "videos")} ${tr("grouped", "grouped")}`
                                                                    : (material.originalName ? `${tr("file_label", "File:")} ${material.originalName}` : tr("uploaded_video", "Uploaded video"))}
                                                                {material.size ? ` • ${formatBytes(material.size)}` : ""}
                                                            </div>
                                                        );
                                                    })()}

                                                    {localizedToString(material.description) && (
                                                        <div className="mt-2 text-xs text-light-600 dark:text-dark-300 max-h-16 overflow-auto break-words">
                                                            {localizedToString(material.description)}
                                                        </div>
                                                    )}

                                                    {localizedToString(material.textContent) && (
                                                        <div className="mt-2">
                                                            <div
                                                                className="p-3 bg-light-100 dark:bg-dark-800 rounded-md text-sm text-light-700 dark:text-dark-300 max-h-28 overflow-auto break-words"
                                                                dangerouslySetInnerHTML={{ __html: formatRichText(localizedToString(material.textContent)) }}
                                                            >
                                                            </div>
                                                        </div>
                                                    )}

                                                    {localizedToString(material.htmlContent) && (
                                                        <div className="mt-2">
                                                            <div className="p-3 bg-light-100 dark:bg-dark-800 rounded-md text-sm text-light-700 dark:text-dark-300 max-h-28 overflow-auto">
                                                                <pre className="whitespace-pre-wrap text-xs break-words">{localizedToString(material.htmlContent)}</pre>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="col-span-12 sm:col-span-2 sm:ml-auto flex items-center justify-end gap-2">
                                                    {(material.type === "photo" || (material.type === "bulk" && !isVideoBulkType(material))) && (() => {
                                                        const photoItems = buildPhotoItems(material);
                                                        const hasMultiple = photoItems.length > 1;
                                                        return (
                                                            <div className="relative" ref={coverPickerMaterialIdx === idx ? coverPickerRef : undefined}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (hasMultiple) {
                                                                            setCoverPickerMaterialIdx(coverPickerMaterialIdx === idx ? null : idx);
                                                                        } else if (photoItems[0]?.url) {
                                                                            setForm((prev: any) => ({
                                                                                ...prev,
                                                                                mainCover: {
                                                                                    url: photoItems[0].url,
                                                                                    mimeType: photoItems[0].mimeType || "image/jpeg",
                                                                                    originalName: photoItems[0].originalName || "cover-from-material",
                                                                                    size: photoItems[0].size || 0,
                                                                                },
                                                                            }));
                                                                            showAlert(tr("imported_to_cover", "Photo imported as main cover"), "success");
                                                                        }
                                                                    }}
                                                                    title={tr("import_to_cover", "Import to Main Cover")}
                                                                    aria-label={tr("import_to_cover", "Import to Main Cover")}
                                                                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 hover:bg-light-100 dark:hover:bg-dark-800 text-light-600 dark:text-dark-400 transition-colors"
                                                                >
                                                                    <ImageIcon className="w-4 h-4" />
                                                                </button>
                                                                {coverPickerMaterialIdx === idx && hasMultiple && (
                                                                    <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-auto rounded-xl border border-light-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-xl p-2">
                                                                        <div className="text-xs font-semibold text-light-500 dark:text-dark-400 px-2 mb-2">{tr("choose_photo", "Choose a photo")}</div>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            {photoItems.map((item, pIdx) => (
                                                                                <button
                                                                                    key={pIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setForm((prev: any) => ({
                                                                                            ...prev,
                                                                                            mainCover: {
                                                                                                url: item.url,
                                                                                                mimeType: item.mimeType || "image/jpeg",
                                                                                                originalName: item.originalName || "cover-from-material",
                                                                                                size: item.size || 0,
                                                                                            },
                                                                                        }));
                                                                                        setCoverPickerMaterialIdx(null);
                                                                                        showAlert(tr("imported_to_cover", "Photo imported as main cover"), "success");
                                                                                    }}
                                                                                    className="relative aspect-square rounded-lg overflow-hidden border border-light-200 dark:border-dark-700 hover:border-primary-500 transition-colors group"
                                                                                >
                                                                                    <img src={item.url} alt={item.originalName || `Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                                        <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    <button type="button" onClick={() => handleEditMaterial(material, idx)} title={tr("edit", "Edit")} aria-label={tr("edit_material", "Edit material")} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 hover:bg-light-100 dark:hover:bg-dark-800 text-light-600 dark:text-dark-400 transition-colors">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteMaterial(material._id, idx)} title={tr("delete", "Delete")} aria-label={tr("delete_material", "Delete material")} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-danger-200 dark:border-danger-900/40 bg-white/70 dark:bg-dark-900/50 hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                    </AnimatePresence>
                                    {form.materials.length === 0 && (
                                        <div className="text-center py-8 text-light-500 dark:text-dark-400">
                                            No materials yet. Click &quot;{tr("add_material", "Add Material")}&quot; to get started.
                                        </div>
                                    )}
                                </Reorder.Group>
                            </div>
                        </div>
                    )}

                    {/* Cast Tab */}
                    {activeTab === "cast" && (
                        <div className="space-y-6">
                            <div className="card p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("cast_and_crew", "Cast & Crew")}</h2>
                                    <div className="flex items-center gap-2">
                                            <button type="button" onClick={handleAddCast} className="btn-primary inline-flex items-center gap-2">
                                                <Plus className="w-4 h-4" />
                                                {tr("add_member", "Add Member")}
                                            </button>
                                        </div>
                                </div>

                                <div className="space-y-3">
                                    {form.cast.map((member: Cast, idx: number) => (
                                        <div
                                            key={member._id || idx}
                                            draggable
                                            onDragStart={() => handleCastDragStart(idx)}
                                            onDragOver={(e) => handleCastDragOver(e)}
                                            onDrop={() => handleCastDrop(idx)}
                                            onDragEnd={handleCastDragEnd}
                                            className={`border border-light-200 dark:border-dark-700 rounded-lg p-4 transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${
                                                draggedCastIndex === idx
                                                    ? "opacity-60 ring-2 ring-light-400 dark:ring-secdark-500"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <span className="inline-flex mt-0.5 h-8 w-8 items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/40 text-light-500 dark:text-dark-400">
                                                        <GripVertical className="w-4 h-4" />
                                                    </span>
                                                    <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {(() => {
                                                            const memberPhotoUrl = getCastPhotoUrl(member.photo);
                                                            if (memberPhotoUrl) {
                                                                return <img src={memberPhotoUrl} alt={member.name} className="w-8 h-8 rounded-full object-cover" />;
                                                            }
                                                            return <User className="w-4 h-4 text-light-500" />;
                                                        })()}
                                                        <span className="font-medium text-light-900 dark:text-dark-50">{member.name}</span>
                                                        <span className="text-sm text-light-500 dark:text-secdark-500">{member.title}</span>
                                                    </div>
                                                    <div className="mb-1">
                                                        <SocialLinkIcons links={member.socialLinks} size={14} className="!gap-1.5" />
                                                    </div>
                                                    <div className="text-xs text-light-400 dark:text-dark-500">{tr("order_label", "Order:")} {member.order}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => handleEditCast(member, idx)} title={tr("edit", "Edit")} aria-label={tr("edit_team_member", "Edit cast member")} className="p-2 rounded-lg hover:bg-light-100 dark:hover:bg-dark-800 text-light-600 dark:text-dark-400 transition-colors">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteCast(idx)} title={tr("delete", "Delete")} aria-label={tr("delete_team_member", "Delete cast member")} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {form.cast.length === 0 && (
                                        <div className="text-center py-8 text-light-500 dark:text-dark-400">
                                            No team members yet. Click &quot;{tr("add_member", "Add Member")}&quot; to add cast or crew.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Cover Tab */}
                    {activeTab === "media" && (
                        <div className="space-y-6">
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">{tr("main_cover_image", "Main Cover Image")}</h2>
                                
                                {form.mainCover ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-md text-sm px-2 py-1 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300">{tr("current_cover", "Current Cover")}</div>
                                                <div className="text-sm text-light-600 dark:text-dark-400">{form.mainCover.originalName}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <label className="inline-flex items-center gap-2 text-sm">
                                                </label>
                                                <div className="relative" ref={coverPickerAllRef}>
                                                    <button type="button" onClick={() => setShowCoverPicker(!showCoverPicker)} className="btn-secondary">
                                                        <ImageIcon className="w-4 h-4 inline mr-2" />{tr("import_from_materials", "Import from Materials")}
                                                    </button>
                                                    {showCoverPicker && (
                                                        <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-auto rounded-xl border border-light-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-xl p-3">
                                                            <div className="text-xs font-semibold text-light-500 dark:text-dark-400 mb-2">{tr("select_photo_from_materials", "Select a photo from your materials")}</div>
                                                             {(() => {
                                                                const allPhotos: { url: string; mimeType?: string; originalName?: string; size?: number }[] = [];
                                                                form.materials.forEach((m: any) => {
                                                                    if (m.type === "video" || (m.type === "bulk" && isVideoBulkType(m))) return;
                                                                    buildPhotoItems(m).forEach((item) => {
                                                                        if (item.url) allPhotos.push(item);
                                                                    });
                                                                });
                                                                if (allPhotos.length === 0) return <div className="text-sm text-light-500 dark:text-dark-400 py-2">{tr("no_photos_available", "No photos in materials yet")}</div>;
                                                                return (
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        {allPhotos.map((item, pIdx) => (
                                                                            <button
                                                                                key={pIdx}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setForm((prev: any) => ({
                                                                                        ...prev,
                                                                                        mainCover: {
                                                                                            url: item.url,
                                                                                            mimeType: item.mimeType || "image/jpeg",
                                                                                            originalName: item.originalName || "cover-from-material",
                                                                                            size: item.size || 0,
                                                                                        },
                                                                                    }));
                                                                                    setMainCoverMeta(null);
                                                                                    setShowCoverPicker(false);
                                                                                }}
                                                                                className="relative aspect-square rounded-lg overflow-hidden border border-light-200 dark:border-dark-700 hover:border-primary-500 transition-colors group"
                                                                            >
                                                                                <img src={item.url} alt={item.originalName || `Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                                    <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                                                    <Upload className="w-4 h-4 inline mr-2" />{tr("replace", "Replace")}
                                                </button>
                                                <button type="button" onClick={handleRemoveMainCover} className="btn-danger">
                                                    <Trash2 className="w-4 h-4 inline mr-2" />{tr("remove", "Remove")}
                                                </button>
                                            </div>
                                        </div>

                                        {cropEnabled ? (
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                                                <div className="col-span-2">
                                                    <div className="rounded-lg overflow-hidden border border-light-200 dark:border-dark-700 relative bg-black/5">
                                                        <img
                                                            ref={(el) => { displayImgRef.current = el; }}
                                                            src={form.mainCover.url}
                                                            crossOrigin="anonymous"
                                                            alt={tr("main_cover_alt", "Main Cover")}
                                                            className="w-full h-auto max-h-[420px] object-contain block"
                                                            onLoad={() => setTimeout(updateOverlayStyle, 20)}
                                                            onClick={(e) => handleImageClickToCenter(e)}
                                                        />
                                                        <div
                                                            style={{ ...overlayStyle, touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
                                                            className="absolute border-2 border-white/80"
                                                            onPointerDown={(e) => handleOverlayPointerDown(e)}
                                                        />
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-3">
                                                        <label className="text-xs text-light-500 dark:text-dark-400">{tr("zoom_label", "Zoom")}</label>
                                                        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
                                                        <button type="button" onClick={() => { setZoom(1); setCropCenter({ x: 0.5, y: 0.5 }); }} className="btn-ghost">{tr("reset", "Reset")}</button>
                                                    </div>

                                                    <div className="mt-2 text-sm text-light-500 dark:text-dark-400">{tr("crop_help_text", "Drag the square on the image to position the 4:5 crop. Use the zoom slider to scale.")}</div>
                                                </div>

                                                <div className="col-span-1">
                                                    <div className="rounded-lg border border-light-200 dark:border-dark-700 overflow-hidden w-full aspect-[4/5] bg-white/5 flex items-center justify-center">
                                                        {croppedPreview ? (
                                                            <img src={croppedPreview} alt={tr("cropped_preview_alt", "Cropped preview")} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="text-sm text-light-500 dark:text-dark-400 p-4">{tr("cropped_preview_4_5", "Cropped preview (4:5)")}</div>
                                                        )}
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <button type="button" onClick={() => { generateCropPreview(); }} className="btn-secondary">{tr("preview", "Preview")}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="rounded-lg overflow-hidden border border-light-200 dark:border-dark-700">
                                                    <div className="max-w-sm mx-auto aspect-[4/5] overflow-hidden rounded">
                                                        <img src={form.mainCover.croppedUrl || form.mainCover.url} alt={tr("main_cover_alt", "Main Cover")} className="w-full h-full object-cover" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-light-500 dark:text-dark-400">{tr("file_name", "File Name:")}</span>
                                                        <span className="ml-2 text-light-900 dark:text-dark-50">{form.mainCover.originalName}</span>
                                                    </div>
                                                  
                                                    <div>
                                                        <span className="text-light-500 dark:text-dark-400">{tr("size_label", "Size:")}</span>
                                                        <span className="ml-2 text-light-900 dark:text-dark-50">{form.mainCover.size ? formatBytes(form.mainCover.size) : "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed border-light-200 dark:border-dark-700 rounded-lg">
                                        <Camera className="w-12 h-12 text-light-400 dark:text-dark-500 mx-auto mb-3" />
                                        <p className="text-light-600 dark:text-dark-400 mb-4 mr-2">{tr("no_main_cover_set", "No main cover image set")}</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="btn-primary inline-flex items-center gap-2"
                                            >
                                                <Upload className="w-4 h-4 inline mr-2" />
                                                {tr("upload_cover_image", "Upload Cover Image")}
                                            </button>
                                            <div className="relative" ref={coverPickerAllRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCoverPicker(!showCoverPicker)}
                                                    className="btn-secondary inline-flex items-center gap-2"
                                                >
                                                    <ImageIcon className="w-4 h-4" />
                                                    {tr("import_from_materials", "Import from Materials")}
                                                </button>
                                                {showCoverPicker && (
                                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-80 max-h-96 overflow-auto rounded-xl border border-light-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-xl p-3">
                                                        <div className="text-xs font-semibold text-light-500 dark:text-dark-400 mb-2">{tr("select_photo_from_materials", "Select a photo from your materials")}</div>
                                                         {(() => {
                                                             const allPhotos: { url: string; mimeType?: string; originalName?: string; size?: number }[] = [];
                                                             form.materials.forEach((m: any) => {
                                                                 if (m.type === "video" || (m.type === "bulk" && isVideoBulkType(m))) return;
                                                                 buildPhotoItems(m).forEach((item) => {
                                                                     if (item.url) allPhotos.push(item);
                                                                 });
                                                             });
                                                            if (allPhotos.length === 0) return <div className="text-sm text-light-500 dark:text-dark-400 py-2">{tr("no_photos_available", "No photos in materials yet")}</div>;
                                                            return (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {allPhotos.map((item, pIdx) => (
                                                                        <button
                                                                            key={pIdx}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setForm((prev: any) => ({
                                                                                    ...prev,
                                                                                    mainCover: {
                                                                                        url: item.url,
                                                                                        mimeType: item.mimeType || "image/jpeg",
                                                                                        originalName: item.originalName || "cover-from-material",
                                                                                        size: item.size || 0,
                                                                                    },
                                                                                }));
                                                                                setMainCoverMeta(null);
                                                                                setShowCoverPicker(false);
                                                                            }}
                                                                            className="relative aspect-square rounded-lg overflow-hidden border border-light-200 dark:border-dark-700 hover:border-primary-500 transition-colors group"
                                                                        >
                                                                            <img src={item.url} alt={item.originalName || `Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                                <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleMainCoverUpload}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
<div className="flex items-center justify-between gap-4 pt-8 mt-8 border-t border-light-200 dark:border-dark-800">
    <Link to="/projects" className="btn-ghost">
        {tr("cancel", "Cancel")}
    </Link>
    
    <div className="flex items-center gap-3">
        {activeTab !== "media" ? (
   <button
    type="button"
    onClick={() => {
        const order: Array<"basic" | "materials" | "cast" | "media"> = ["basic", "materials", "cast", "media"];
        const idx = order.indexOf(activeTab);
        const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : "media";
        setActiveTab(next); // TypeScript now knows next is of the correct type
    }}
    className="btn-primary inline-flex items-center gap-2"
>
    <Plus className="w-4 h-4" />
    {tr("next", "Next")}
</button>
) : (
    <button
        type="button"  // Change from "submit" to "button"
        onClick={handleSubmit}  // Call handleSubmit directly
        disabled={isSaving}
        className={`inline-flex items-center gap-2 min-w-[120px] justify-center rounded-lg px-4 py-2 transition-colors ${
            isSaving
                ? "bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-200 border border-light-200 dark:border-dark-700 cursor-not-allowed"
                : "btn-primary"
        }`}
    >
        {saveStatus === "saving" && (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {saveStatus === "success" && <CheckCircle className="w-4 h-4" />}
        {saveStatus === "error" && <AlertCircle className="w-4 h-4" />}
        {saveStatus === "idle" && <CheckCircle className="w-4 h-4" />}
        {saveStatus === "saving" && tr("creating", "Creating...")}
        {saveStatus === "success" && tr("created", "Created!")}
        {saveStatus === "error" && tr("failed", "Failed!")}
        {saveStatus === "idle" && tr("create_project", "Create Project")}
    </button>
)}
    </div>
</div>
                </form>
            </div>

            {uploadModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
                    <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("creating_project", "Creating project")}</h3>
                        <div className="mt-2 text-sm text-light-600 dark:text-dark-400">{uploadLabel || tr("working", "Working...")}</div>

                        <div className="mt-4 w-full bg-light-100 dark:bg-dark-700 h-3 rounded-full overflow-hidden">
                            <div className="h-3 bg-light-500 dark:bg-secdark-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-light-500 dark:text-dark-400">
                            <div>{uploadProgress}%</div>
                            <div>{estimatedSecondsLeft !== null ? `${formatTimeShort(estimatedSecondsLeft)} ${tr("remaining", "remaining")}` : tr("estimating", "Estimating...")}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Upload Progress Overlay */}
            <UploadProgressOverlay
                open={photoUpload.open}
                progress={photoUpload.progress}
                estimatedSecondsLeft={photoUpload.estimatedSecondsLeft}
                title={photoUpload.title}
                label={photoUpload.label}
            />

            {/* Material Edit Modal */}
            {editingMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-light-200 dark:border-dark-700 p-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-light-900 dark:text-dark-50">
                                {editingMaterial._id ? tr("edit_material", "Edit Material") : tr("add_material", "Add Material")}
                            </h3>
                            <button onClick={() => setEditingMaterial(null)} className="p-1 hover:bg-light-100 dark:hover:bg-dark-700 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("type_label", "Type")}</label>
                                <select
                                    value={editingMaterial.type}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, type: e.target.value as any })}
                                    className="input w-full"
                                >
                                    <option value="photo">{tr("photo", "Photo")}</option>
                                    <option value="video">{tr("video", "Video")}</option>
                                    <option value="before_after">{tr("before_after", "Before/After")}</option>
                                    <option value="text">{tr("text", "Text")}</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("title_en", "Title (English)")}</label>
                                <input
                                    type="text"
                                    value={editingMaterial.caption?.en || ""}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, caption: { ...editingMaterial.caption, en: e.target.value } })}
                                    className="input w-full"
                                    placeholder={tr("optional_caption_en", "Optional caption (English)")}
                                />
                                <div className="mt-1.5">
                                    <TranslateButton onClick={matCaptionEnToAr.translate} isTranslating={matCaptionEnToAr.isTranslating} disabled={!editingMaterial?.caption?.en?.trim()} />
                                </div>
                                <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("title_ar", "Title (Arabic)")}</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    value={editingMaterial.caption?.ar || ""}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, caption: { ...editingMaterial.caption, ar: e.target.value } })}
                                    className="input w-full"
                                    placeholder="عنوان اختياري (بالعربية)"
                                />
                                <div className="mt-1.5">
                                    <TranslateButton onClick={matCaptionArToEn.translate} isTranslating={matCaptionArToEn.isTranslating} disabled={!editingMaterial?.caption?.ar?.trim()} label="Translate to EN" />
                                </div>
                            </div>

                            <div>
                                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("description_en", "Description (English)")}
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={editingMaterial.description?.en || ""}
                                        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                                        onChange={(e) =>
                                            setEditingMaterial({
                                                ...editingMaterial,
                                                description: {
                                                    ...editingMaterial.description,
                                                    en: e.target.value,
                                                },
                                            })
                                        }
                                        className="input w-full resize-none overflow-hidden min-h-[100px]"
                                        placeholder={t("material_description_en") || "Optional description (English)"}
                                    />
                                    <div className="mt-1.5">
                                        <TranslateButton onClick={matDescEnToAr.translate} isTranslating={matDescEnToAr.isTranslating} disabled={!editingMaterial?.description?.en?.trim()} />
                                    </div>
                                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("description_ar", "Description (Arabic)")}
                                    </label>
                                    <textarea
                                        dir="rtl"
                                        rows={4}
                                        value={editingMaterial.description?.ar || ""}
                                        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                                        onChange={(e) =>
                                            setEditingMaterial({
                                                ...editingMaterial,
                                                description: {
                                                    ...editingMaterial.description,
                                                    ar: e.target.value,
                                                },
                                            })
                                        }
                                        className="input w-full resize-none overflow-hidden min-h-[100px]"
                                        placeholder={t("material_description_ar") || "وصف اختياري (بالعربية)"}
                                    />
                                    <div className="mt-1.5">
                                        <TranslateButton onClick={matDescArToEn.translate} isTranslating={matDescArToEn.isTranslating} disabled={!editingMaterial?.description?.ar?.trim()} label="Translate to EN" />
                                    </div>
                                </div>

                            {(editingMaterial.type === "photo" || editingMaterial.type === "video" || editingMaterial.type === "bulk") && (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            {editingMaterial.type === "photo" ? tr("upload_photos", "Upload photos") : tr("upload_file", "Upload file")}
                                        </label>
                                        <input
                                            type="file"
                                            accept={editingMaterial.type === "photo" ? "image/*" : "video/*"}
                                            multiple={editingMaterial.type === "photo" || editingMaterial.type === "video" || editingMaterial.type === "bulk"}
                                            onChange={handleMaterialFileUpload}
                                            className="input w-full"
                                        />
                                    </div>

                                    {editingMaterial.type === "photo" && (() => {
                                        const groupedPhotoItems = buildPhotoItems(editingMaterial);
                                        if (groupedPhotoItems.length === 0) return null;

                                        return (
                                            <div className="mt-3">
                                                <div className="text-xs text-light-500 dark:text-dark-400 mb-2">
                                                    {groupedPhotoItems.length} {groupedPhotoItems.length === 1 ? tr("photo", "photo") : tr("photos", "photos")} {tr("grouped_under_title", "grouped under this title")}
                                                </div>
                                                <DndContext sensors={photoSensors} collisionDetection={closestCenter} onDragEnd={(event) => {
                                                    const { active, over } = event;
                                                    if (over && active.id !== over.id) {
                                                        const oldIndex = groupedPhotoItems.findIndex((it, i) => `${it.originalName || it.url}-${i}` === active.id);
                                                        const newIndex = groupedPhotoItems.findIndex((it, i) => `${it.originalName || it.url}-${i}` === over.id);
                                                        if (oldIndex !== -1 && newIndex !== -1) {
                                                            handlePhotoItemReorder(arrayMove(groupedPhotoItems, oldIndex, newIndex));
                                                        }
                                                    }
                                                }}>
                                                    <SortableContext items={groupedPhotoItems.map((it, i) => `${it.originalName || it.url}-${i}`)} strategy={verticalListSortingStrategy}>
                                                        <div className="space-y-2">
                                                            {groupedPhotoItems.map((item, itemIndex) => (
                                                                <SortablePhotoItem key={`${item.originalName || item.url}-${itemIndex}`} item={item} index={itemIndex} onRemove={handleRemovePhotoItem} removeLabel={tr("remove_photo", "Remove photo")} />
                                                            ))}
                                                        </div>
                                                    </SortableContext>
                                                </DndContext>
                                            </div>
                                        );
                                    })()}

                                    {(() => {
                                        const matType = editingMaterial.type;
                                        const isVideoType = matType === "video" || matType === "bulk";
                                        if (!isVideoType) return null;
                                        const videoItems = buildVideoItems(editingMaterial);
                                        if (videoItems.length === 0) return null;

                                        return (
                                            <div className="mt-3">
                                                {videoItems.length > 1 && (
                                                    <div className="text-xs text-light-500 dark:text-dark-400 mb-2">
                                                        {videoItems.length} {tr("videos", "videos")} {tr("grouped_under_title", "grouped under this title")}
                                                    </div>
                                                )}
                                                <DndContext sensors={photoSensors} collisionDetection={closestCenter} onDragEnd={(event) => {
                                                    const { active, over } = event;
                                                    if (over && active.id !== over.id) {
                                                        const oldIndex = videoItems.findIndex((it, i) => `${it.originalName || it.url}-${i}` === active.id);
                                                        const newIndex = videoItems.findIndex((it, i) => `${it.originalName || it.url}-${i}` === over.id);
                                                        if (oldIndex !== -1 && newIndex !== -1) {
                                                            handleVideoItemReorder(arrayMove(videoItems, oldIndex, newIndex));
                                                        }
                                                    }
                                                }}>
                                                    <SortableContext items={videoItems.map((it, i) => `${it.originalName || it.url}-${i}`)} strategy={verticalListSortingStrategy}>
                                                        <div className="space-y-2">
                                                            {videoItems.map((item, itemIndex) => (
                                                                <SortableVideoItem key={`${item.originalName || item.url}-${itemIndex}`} item={item} index={itemIndex} onRemove={handleRemoveVideoItem} onThumbnailUpload={handleVideoItemThumbnailUpload} onRemoveThumbnail={handleRemoveVideoItemThumbnail} onFrameSelect={handleVideoItemFrameSelect} onFrameSelectForCover={handleCaptureFrameForCover} removeLabel={tr("remove_video", "Remove video")} materialCaption={localizedToString(editingMaterial?.caption)} materialDescription={localizedToString(editingMaterial?.description)} />
                                                            ))}
                                                        </div>
                                                    </SortableContext>
                                                </DndContext>
                                            </div>
                                        );
                                    })()}

                                    {(() => {
                                        const isVidType = editingMaterial.type === "video" || (editingMaterial.type === "bulk" && isVideoBulkType(editingMaterial));
                                        if (!isVidType) return null;
                                        return null;
                                    })()}
                                  
                                </>
                            )}

                            {editingMaterial.type === "text" && (
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("text_content_en", "Text Content (English)")}</label>
                                    <div className="project-quill rounded-xl overflow-hidden border border-light-200 dark:border-dark-700">
                                        <ReactQuill
                                            theme="snow"
                                            value={editingMaterial.textContent?.en || ""}
                                            onChange={(value) => setEditingMaterial({ ...editingMaterial, textContent: { ...editingMaterial.textContent, en: value } })}
                                            placeholder={tr("enter_text_content_en", "Enter your text content here... (English)")}
                                        />
                                    </div>
                                    <div className="mt-1.5">
                                        <TranslateButton onClick={matTextEnToAr.translate} isTranslating={matTextEnToAr.isTranslating} disabled={!editingMaterial?.textContent?.en?.trim()} />
                                    </div>
                                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("text_content_ar", "Text Content (Arabic)")}</label>
                                    <div className="project-quill rounded-xl overflow-hidden border border-light-200 dark:border-dark-700">
                                        <ReactQuill
                                            theme="snow"
                                            value={editingMaterial.textContent?.ar || ""}
                                            onChange={(value) => setEditingMaterial({ ...editingMaterial, textContent: { ...editingMaterial.textContent, ar: value } })}
                                            placeholder="أدخل محتوى النص هنا (بالعربية)"
                                        />
                                    </div>
                                    <div className="mt-1.5">
                                        <TranslateButton onClick={matTextArToEn.translate} isTranslating={matTextArToEn.isTranslating} disabled={!editingMaterial?.textContent?.ar?.trim()} label="Translate to EN" />
                                    </div>
                                </div>
                            )}

                        

                            {editingMaterial.type === "before_after" && (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("before_image", "Before Image")}</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleBeforeAfterUpload(e, 'before')}
                                            className="input w-full"
                                        />

                                        {editingMaterial.before?.url && (
                                            <div className="mt-3">
                                                <img src={editingMaterial.before.url} alt={tr("before_preview_alt", "Before preview")} className="w-full h-40 object-cover rounded" />
                                                <div className="mt-2 text-xs text-light-500 dark:text-dark-400">{tr("file_label", "File:")} {editingMaterial.before.originalName || tr("uploaded_image", "Uploaded image")}</div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div>
                                                <input
                                                    type="text"
                                                    value={editingMaterial.before?.label?.en || ""}
                                                    onChange={(e) =>
                                                        setEditingMaterial({
                                                            ...editingMaterial,
                                                            before: { ...(editingMaterial.before as any), label: { ...((editingMaterial.before as any)?.label || {}), en: e.target.value } },
                                                        } as any)
                                                    }
                                                    className="input w-full"
                                                    placeholder={tr("before_label_en", "Before label (EN)")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={matBeforeEnToAr.translate} isTranslating={matBeforeEnToAr.isTranslating} disabled={!editingMaterial?.before?.label?.en?.trim()} />
                                                </div>
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={editingMaterial.before?.label?.ar || ""}
                                                    onChange={(e) =>
                                                        setEditingMaterial({
                                                            ...editingMaterial,
                                                            before: { ...(editingMaterial.before as any), label: { ...((editingMaterial.before as any)?.label || {}), ar: e.target.value } },
                                                        } as any)
                                                    }
                                                    className="input w-full"
                                                    placeholder="قبل (AR)"
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={matBeforeArToEn.translate} isTranslating={matBeforeArToEn.isTranslating} disabled={!editingMaterial?.before?.label?.ar?.trim()} label="Translate to EN" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("after_image", "After Image")}</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleBeforeAfterUpload(e, 'after')}
                                            className="input w-full"
                                        />

                                        {editingMaterial.after?.url && (
                                            <div className="mt-3">
                                                <img src={editingMaterial.after.url} alt={tr("after_preview_alt", "After preview")} className="w-full h-40 object-cover rounded" />
                                                <div className="mt-2 text-xs text-light-500 dark:text-dark-400">{tr("file_label", "File:")} {editingMaterial.after.originalName || tr("uploaded_image", "Uploaded image")}</div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div>
                                                <input
                                                    type="text"
                                                    value={editingMaterial.after?.label?.en || ""}
                                                    onChange={(e) =>
                                                        setEditingMaterial({
                                                            ...editingMaterial,
                                                            after: { ...(editingMaterial.after as any), label: { ...((editingMaterial.after as any)?.label || {}), en: e.target.value } },
                                                        } as any)
                                                    }
                                                    className="input w-full"
                                                    placeholder={tr("after_label_en", "After label (EN)")}
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={matAfterEnToAr.translate} isTranslating={matAfterEnToAr.isTranslating} disabled={!editingMaterial?.after?.label?.en?.trim()} />
                                                </div>
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={editingMaterial.after?.label?.ar || ""}
                                                    onChange={(e) =>
                                                        setEditingMaterial({
                                                            ...editingMaterial,
                                                            after: { ...(editingMaterial.after as any), label: { ...((editingMaterial.after as any)?.label || {}), ar: e.target.value } },
                                                        } as any)
                                                    }
                                                    className="input w-full"
                                                    placeholder="بعد (AR)"
                                                />
                                                <div className="mt-1">
                                                    <TranslateButton onClick={matAfterArToEn.translate} isTranslating={matAfterArToEn.isTranslating} disabled={!editingMaterial?.after?.label?.ar?.trim()} label="Translate to EN" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setEditingMaterial(null)} className="btn-ghost">{tr("cancel", "Cancel")}</button>
                                <button onClick={handleSaveMaterial} className="btn-primary">{tr("save_material", "Save Material")}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            

            {/* Cast Edit Modal */}
            {editingCast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingCast(null)}>
                    <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="border-b border-light-200 dark:border-dark-700 p-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-light-900 dark:text-dark-50">
                                {castModalMode === "edit" ? tr("edit_team_member", "Edit Team Member") : tr("add_team_member", "Add Team Member")}
                            </h3>
                            <button onClick={() => setEditingCast(null)} className="p-1 hover:bg-light-100 dark:hover:bg-dark-700 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">

                                    {castModalMode === "edit" ? (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("name_label", "Name")}</label>
                                        <input
                                            type="text"
                                            value={editingCast.name}
                                            onChange={(e) => setEditingCast({ ...editingCast, name: e.target.value })}
                                            className="input w-full"
                                            placeholder={tr("full_name", "Full name")}
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("title_role", "Title/Role")}</label>
                                        <input
                                            type="text"
                                            value={editingCast.title}
                                            onChange={(e) => setEditingCast({ ...editingCast, title: e.target.value })}
                                            className="input w-full"
                                            placeholder={tr("title_role_placeholder", "e.g., Creative Director, Photographer")}
                                        />
                                    </div>
                                    <CastSocialLinks
                                        value={editingCast.socialLinks || []}
                                        onChange={(links) => setEditingCast({ ...editingCast, socialLinks: links })}
                                    />
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("photo_label", "Photo")}</label>
                                        {(() => {
                                            const photoUrl = getCastPhotoUrl(editingCast.photo);
                                            if (photoUrl) {
                                                return (
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <img src={photoUrl} alt={editingCast.name || "Member"} className="w-16 h-16 rounded-full object-cover border border-light-200 dark:border-dark-700" />
                                                        <button type="button" onClick={() => setEditingCast({ ...editingCast, photo: null })} className="btn-ghost">{tr("remove", "Remove")}</button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <input type="file" accept="image/*" onChange={handleCastPhotoUpload} className="input w-full" />
                                    </div>
                                </>
                            ) : (
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">{tr("members_label", "Members")}</label>
                                            <p className="text-xs text-light-500 dark:text-dark-400 mb-2">{tr("members_hint", "Select existing members or add new ones below. Use")} <span className="font-medium">{tr("add_member", "Add Member")}</span> {tr("to_append_rows", "to append rows.")}</p>

                                            <Autocomplete
                                                multiple
                                                disablePortal
                                                filterSelectedOptions
                                                options={projectCast}
                                                value={selectedExistingCast}
                                                onChange={(_, val) => setSelectedExistingCast(val as any[])}
                                                getOptionLabel={getOptionLabel}
                                                isOptionEqualToValue={(o, v) => (o._id || o.id) === (v._id || v.id)}
                                                className="w-full mb-3"
                                                sx={taxonomyAutocompleteSx}
                                                slotProps={taxonomyAutocompleteSlotProps}
                                                renderOption={(props, option: any) => (
                                                    <li {...props} className="flex items-center gap-3 px-3 py-2">
                                                        {(() => {
                                                            const optionPhotoUrl = getCastPhotoUrl(option.photo);
                                                            if (optionPhotoUrl) {
                                                                return <img src={optionPhotoUrl} alt={getOptionLabel(option)} className="w-8 h-8 rounded-full object-cover shrink-0" />;
                                                            }
                                                            return (
                                                                <div className="w-8 h-8 rounded-full bg-light-100 dark:bg-dark-800 flex items-center justify-center text-sm font-medium text-light-700 dark:text-dark-200 shrink-0">
                                                                    {getOptionLabel(option).charAt(0).toUpperCase()}
                                                                </div>
                                                            );
                                                        })()}
                                                        <div className="flex-1">
                                                            <div className="font-medium text-sm text-light-900 dark:text-dark-50">{getOptionLabel(option)}</div>
                                                            {option.title && <div className="text-xs text-light-500 dark:text-dark-400">{option.title}</div>}
                                                        </div>
                                                    </li>
                                                )}
                                                renderTags={(value: any[], getTagProps) =>
                                                    value.map((option, index) => {
                                                        const label = getOptionLabel(option);
                                                        const initial = label ? label.charAt(0).toUpperCase() : "?";
                                                        const optionPhotoUrl = getCastPhotoUrl(option.photo);
                                                        return (
                                                            <Chip
                                                                label={label}
                                                                avatar={
                                                                    optionPhotoUrl ? (
                                                                        <Avatar src={optionPhotoUrl} sx={{ width: 20, height: 20 }}>{initial}</Avatar>
                                                                    ) : (
                                                                        <Avatar sx={{ width: 20, height: 20, fontSize: 12 }}>{initial}</Avatar>
                                                                    )
                                                                }
                                                                size="small"
                                                                {...getTagProps({ index })}
                                                            />
                                                        );
                                                    })
                                                }
                                                renderInput={(params) => <TextField {...params} placeholder={tr("search_existing_members", "Search existing members")} size="small" />}
                                            />

                                            {newMembersRows.map((row, rIdx) => (
                                                <div key={rIdx} className="mb-3">
                                                    <div className="grid grid-cols-12 gap-2 items-center mb-2">
                                                        <input
                                                            type="text"
                                                            value={row.name}
                                                            onChange={(e) => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, name: e.target.value } : p)))}
                                                            className="input col-span-7"
                                                            placeholder={tr("full_name", "Full name")}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={row.title}
                                                            onChange={(e) => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, title: e.target.value } : p)))}
                                                            className="input col-span-4"
                                                            placeholder={tr("title_role_optional", "Title/Role (optional)")}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewMembersRows((prev) => prev.filter((_, i) => i !== rIdx))}
                                                            className="p-2 rounded hover:bg-light-100 dark:hover:bg-dark-800 text-danger-500"
                                                            title={tr("remove", "Remove")}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <CastSocialLinks
                                                        value={row.socialLinks || []}
                                                        onChange={(links) => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, socialLinks: links } : p)))}
                                                    />
                                                    <div className="mt-2">
                                                        {(() => {
                                                            const rowPhotoUrl = getCastPhotoUrl(row.photo);
                                                            if (rowPhotoUrl) {
                                                                return (
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <img src={rowPhotoUrl} alt={row.name || "Member"} className="w-10 h-10 rounded-full object-cover border border-light-200 dark:border-dark-700" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, photo: null } : p)))}
                                                                            className="btn-ghost text-xs"
                                                                        >
                                                                            {tr("remove", "Remove")}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        <input type="file" accept="image/*" onChange={(e) => handleCastRowPhotoUpload(e, rIdx)} className="input w-full" />
                                                    </div>
                                                </div>
                                            ))}

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setNewMembersRows((prev) => [...prev, { name: "", title: "", order: form.cast.length + prev.length + 1, socialLinks: [], photo: null }])}
                                                    className="btn-secondary"
                                                >
                                                    <Plus className="w-4 h-4 inline mr-2" />
                                                    {tr("add_member", "Add Member")}
                                                </button>
                                            </div>
                                        </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setEditingCast(null)} className="btn-ghost">{tr("cancel", "Cancel")}</button>
                                <button onClick={handleSaveCast} className="btn-primary">{castModalMode === "edit" ? tr("save_member", "Save Member") : tr("save_members", "Save Members")}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddProject;