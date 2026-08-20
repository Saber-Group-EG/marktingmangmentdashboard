import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject, useProjectTypes, useProjectCast, useProjects, useCategories, useProjectCompanies, useCreateProjectCompany } from "@/hooks/queries";
import { useLang } from "@/hooks/useLang";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import CastSocialLinks from "@/components/CastSocialLinks";
import SocialLinkIcons from "@/components/SocialLinkIcons";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { isDataUrl, uploadDataUrlToR2Cached, uploadDataUrlToR2 } from "@/utils/r2Upload";
import { compressImageFileToMaxBytes } from "@/utils/imageCompression";
import { createCategory } from "@/api/requests/categoriesService";
import { createType } from "@/api/requests/typesService";
import { useAutoTranslatePair } from "@/hooks/useAutoTranslatePair";
import { useAutoTranslateList } from "@/hooks/useAutoTranslateList";
import { stripHtml, toLocalizedItems, mergeLocalizedAr } from "@/utils/translateText";
import { Autocomplete, TextField, Chip, Avatar } from "@mui/material";
import { 
  Save, Trash2, X, ArrowLeft, Loader2, 
  FileText, Info, AlertCircle, CheckCircle, Plus,
  Edit, Eye, MapPin,  Users, Layers,
        Image, Video, Code, Upload, GripVertical,
  Camera
} from "lucide-react";

interface Material {
  _id?: string;
        type: "photo" | "bulk" | "video" | "before_after" | "text" | "html";
  order: number;
  caption?: any;
  url?: string;
  mimeType?: string;
  size?: number;
  originalName?: string;
        items?: PhotoMaterialItem[];
  textContent?: any;
  htmlContent?: any;
        thumbnail?: string | { url: string; mimeType?: string; size?: number; originalName?: string };
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


const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const v = t(key);
        return !v || v === key ? fallback : v;
    };
    void tr; // to avoid unused variable warning if translation is not used in this file
    const navigate = useNavigate();

    const localizedToString = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") return value[lang] || value.en || value.ar || "";
        return "";
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

    const { data: project, isLoading, error } = useProject(id);
    const { data: projectCast = []} = useProjectCast();
    const { data: allProjects = [] as any[] } = useProjects();
    const update = useUpdateProject();
    const del = useDeleteProject();
    // Replace useProjectCategories with useCategories
    const { data: projectCategoriesResponse, isLoading: projectCategoriesLoading } = useCategories({ type: "project" });
    const projectCategories = projectCategoriesResponse?.categories || [];
    const { data: projectTypes = [], isLoading: projectTypesLoading } = useProjectTypes();
    const { data: projectCompanies = [] } = useProjectCompanies();

    const [form, setForm] = useState<any>({
        name: "",
        description: "",
        location: "",
        order: 0,
        published: false,
        categories: [] as string[],
        tags: [] as string[],
        types: [] as string[],
        materials: [] as Material[],
        cast: [] as Cast[],
        mainCover: null as any,
        parentProject: null as any,
        company: null as any,
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [activeTab, setActiveTab] = useState<"basic" | "materials" | "cast" | "media">("basic");
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [draggedMaterialIndex, setDraggedMaterialIndex] = useState<number | null>(null);
    const [editingCast, setEditingCast] = useState<Cast | null>(null);
    const [castModalMode, setCastModalMode] = useState<"add" | "edit">("add");
    const [editingCastIndex, setEditingCastIndex] = useState<number | null>(null);
    const [newMembersRows, setNewMembersRows] = useState<Cast[]>([]);
    const [selectedExistingCast, setSelectedExistingCast] = useState<any[]>([]);
    const [draggedCastIndex, setDraggedCastIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useAutoTranslatePair(form.name?.en || "", form.name?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, name: { ...prev.name, ar: t } })));
    useAutoTranslatePair(form.name?.ar || "", form.name?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, name: { ...prev.name, en: t } })));
    useAutoTranslatePair(form.description?.en || "", form.description?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, description: { ...prev.description, ar: t } })));
    useAutoTranslatePair(form.description?.ar || "", form.description?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, description: { ...prev.description, en: t } })));
    useAutoTranslatePair(form.location?.en || "", form.location?.ar || "", "ar", (t) => setForm((prev: any) => ({ ...prev, location: { ...prev.location, ar: t } })));
    useAutoTranslatePair(form.location?.ar || "", form.location?.en || "", "en", (t) => setForm((prev: any) => ({ ...prev, location: { ...prev.location, en: t } })));
    useAutoTranslatePair(newTag, newTagAr, "ar", setNewTagAr);
    useAutoTranslatePair(newTagAr, newTag, "en", setNewTag);
    useAutoTranslatePair(newCategory, newCategoryAr, "ar", setNewCategoryAr);
    useAutoTranslatePair(newCategoryAr, newCategory, "en", setNewCategory);
    useAutoTranslatePair(newType, newTypeAr, "ar", setNewTypeAr);
    useAutoTranslatePair(newTypeAr, newType, "en", setNewType);
    useAutoTranslatePair(newCompanyEn, newCompanyAr, "ar", setNewCompanyAr);
    useAutoTranslatePair(newCompanyAr, newCompanyEn, "en", setNewCompanyEn);
    useAutoTranslatePair(editingMaterial?.caption?.en || "", editingMaterial?.caption?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, caption: { ...prev.caption, ar: t } } : prev)));
    useAutoTranslatePair(editingMaterial?.caption?.ar || "", editingMaterial?.caption?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, caption: { ...prev.caption, en: t } } : prev)));
    useAutoTranslatePair(stripHtml(editingMaterial?.textContent?.en || ""), editingMaterial?.textContent?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, textContent: { ...prev.textContent, ar: t } } : prev)));
    useAutoTranslatePair(stripHtml(editingMaterial?.textContent?.ar || ""), editingMaterial?.textContent?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, textContent: { ...prev.textContent, en: t } } : prev)));
    useAutoTranslatePair(editingMaterial?.before?.label?.en || "", editingMaterial?.before?.label?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, before: { ...prev.before, url: prev.before?.url || "", label: { ...prev.before?.label, ar: t } } } : prev)));
    useAutoTranslatePair(editingMaterial?.before?.label?.ar || "", editingMaterial?.before?.label?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, before: { ...prev.before, url: prev.before?.url || "", label: { ...prev.before?.label, en: t } } } : prev)));
    useAutoTranslatePair(editingMaterial?.after?.label?.en || "", editingMaterial?.after?.label?.ar || "", "ar", (t) => setEditingMaterial((prev) => (prev ? { ...prev, after: { ...prev.after, url: prev.after?.url || "", label: { ...prev.after?.label, ar: t } } } : prev)));
    useAutoTranslatePair(editingMaterial?.after?.label?.ar || "", editingMaterial?.after?.label?.en || "", "en", (t) => setEditingMaterial((prev) => (prev ? { ...prev, after: { ...prev.after, url: prev.after?.url || "", label: { ...prev.after?.label, en: t } } } : prev)));

    const tagItems = useMemo(() => toLocalizedItems(form.tags), [form.tags]);
    useAutoTranslateList(tagItems, (index, ar) =>
        setForm((prev: any) => ({ ...prev, tags: prev.tags.map((t: any, i: number) => (i === index ? mergeLocalizedAr(t, ar) : t)) })),
    );
    const categoryItems = useMemo(() => toLocalizedItems(form.categories), [form.categories]);
    useAutoTranslateList(categoryItems, (index, ar) =>
        setForm((prev: any) => ({ ...prev, categories: prev.categories.map((c: any, i: number) => (i === index ? mergeLocalizedAr(c, ar) : c)) })),
    );
    const typeItems = useMemo(() => toLocalizedItems(form.types), [form.types]);
    useAutoTranslateList(typeItems, (index, ar) =>
        setForm((prev: any) => ({ ...prev, types: prev.types.map((t: any, i: number) => (i === index ? mergeLocalizedAr(t, ar) : t)) })),
    );
    const materialCaptionItems = useMemo(
        () => form.materials.map((m: Material) => ({ en: m.caption?.en || "", ar: m.caption?.ar || "" })),
        [form.materials],
    );
    useAutoTranslateList(materialCaptionItems, (index, ar) =>
        setForm((prev: any) => ({
            ...prev,
            materials: prev.materials.map((m: Material, i: number) => (i === index ? { ...m, caption: { ...m.caption, ar } } : m)),
        })),
    );
    const materialTextItems = useMemo(
        () => form.materials.map((m: Material) => ({ en: stripHtml(m.textContent?.en || ""), ar: stripHtml(m.textContent?.ar || "") })),
        [form.materials],
    );
    useAutoTranslateList(materialTextItems, (index, ar) =>
        setForm((prev: any) => ({
            ...prev,
            materials: prev.materials.map((m: Material, i: number) => (i === index ? { ...m, textContent: { ...m.textContent, ar } } : m)),
        })),
    );
    const materialBeforeLabelItems = useMemo(
        () => form.materials.map((m: Material) => ({ en: m.before?.label?.en || "", ar: m.before?.label?.ar || "" })),
        [form.materials],
    );
    useAutoTranslateList(materialBeforeLabelItems, (index, ar) =>
        setForm((prev: any) => ({
            ...prev,
            materials: prev.materials.map((m: Material, i: number) =>
                i === index ? { ...m, before: { ...m.before, url: m.before?.url || "", label: { ...m.before?.label, ar } } } : m,
            ),
        })),
    );
    const materialAfterLabelItems = useMemo(
        () => form.materials.map((m: Material) => ({ en: m.after?.label?.en || "", ar: m.after?.label?.ar || "" })),
        [form.materials],
    );
    useAutoTranslateList(materialAfterLabelItems, (index, ar) =>
        setForm((prev: any) => ({
            ...prev,
            materials: prev.materials.map((m: Material, i: number) =>
                i === index ? { ...m, after: { ...m.after, url: m.after?.url || "", label: { ...m.after?.label, ar } } } : m,
            ),
        })),
    );

    // Photo selection upload progress overlay
    const photoUpload = useUploadProgress();

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
            const label = getOptionLabel(item).trim();
            if (!label) continue;
            const existing = options.find((o: any) => getOptionLabel(o).toLowerCase() === label.toLowerCase());
            if (existing && getOptionValue(existing)) {
                resolved.push(getOptionValue(existing));
                continue;
            }
            const rawId = typeof item === "string" ? item.trim() : getOptionValue(item);
            if (rawId && /^[0-9a-fA-F]{24}$/.test(rawId)) {
                resolved.push(rawId);
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

    const readFileAsDataUrl = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });

    const handleVideoThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                    setEditingMaterial((prev) => (prev ? { ...prev, thumbnail: { url: dataUrl, mimeType: file.type, originalName: file.name, size: file.size } } : prev));
                },
            });
        } catch {
            // ignore
        } finally {
            if (e.target) e.target.value = "";
        }
    };

    const isPhotoMaterialType = (type?: string): boolean => type === "photo" || type === "bulk";

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

    const unwrapMaterialFromServer = (material: any): Material => {
        const unwrapped: any = { ...material };
        unwrapped.caption = toLocalizedString(material?.caption);
        unwrapped.textContent = toLocalizedString(material?.textContent);
        unwrapped.htmlContent = toLocalizedString(material?.htmlContent);
        if (material?.before) unwrapped.before = localizeSideLabel(material.before);
        if (material?.after) unwrapped.after = localizeSideLabel(material.after);
        if (Array.isArray(material?.items)) {
            unwrapped.items = material.items.map((item: any) => ({
                ...item,
                caption: toLocalizedString(item?.caption),
                before: item?.before ? localizeSideLabel(item.before) : item?.before,
                after: item?.after ? localizeSideLabel(item.after) : item?.after,
            }));
        }
        return unwrapped;
    };

    const normalizeProjectMaterials = (materials: any[] = []): Material[] => {
        const sorted = [...materials].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sorted
            .map(unwrapMaterialFromServer)
            .map((material) => (isPhotoMaterialType(material.type) ? normalizePhotoMaterial({ ...material }) : { ...material }))
            .map((material, index) => ({ ...material, order: index + 1 }));
    };

    const formInitializedRef = useRef(false);

    useEffect(() => {
        if (!project) return;
        if (formInitializedRef.current) return;
        formInitializedRef.current = true;

        const rawCast = project.cast || [];
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

                if (c.name) {
                    const found = projectCast.find((pc: any) => (pc._id || pc.id) === c.name || pc.name === c.name);
                    return {
                        ...c,
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

        // derive parentProject option from server payload when available
        let parentInitial: any = null;
        const rawParent: any = (project as any).parentProject;
        if (rawParent) {
            if (typeof rawParent === 'string') {
                const found = allProjects.find((p: any) => (p.id || p._id) === rawParent || p.name === rawParent);
                parentInitial = found || rawParent;
            } else if (typeof rawParent === 'object') {
                const pid = rawParent._id || rawParent.id;
                const found = pid ? allProjects.find((p: any) => (p.id || p._id) === pid) : allProjects.find((p: any) => p.name === rawParent.name);
                parentInitial = found || rawParent;
            }
        }

        // derive project company option from server payload when available
        let companyInitial: any = null;
        const rawCompany: any = (project as any).company;
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

        setForm({
            name: toLocalizedString((project as any).localizedName ?? project.name),
            description: toLocalizedString((project as any).localizedDescription ?? (project as any).description),
            location: toLocalizedString((project as any).localizedLocation ?? (project as any).location),
            order: Number((project as any).order) || 0,
            published: project.published || false,
            categories: project.categories || [],
            tags: project.tags || [],
            types: project.types || [],
            materials: normalizeProjectMaterials(project.material || []),
            cast: mappedCast,
            mainCover: project.mainCover || null,
            parentProject: parentInitial,
            company: companyInitial,
        });
    }, [project, projectCast, allProjects]);

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
        setEditingMaterial(newMaterial);
    };

    const handleEditMaterial = (material: Material) => {
        const normalized = isPhotoMaterialType(material.type) ? normalizePhotoMaterial({ ...material }) : { ...material };
        setEditingMaterial(normalized);
    };

    const handleSaveMaterial = () => {
        if (editingMaterial) {
            const materialToSave = isPhotoMaterialType(editingMaterial.type) ? normalizePhotoMaterial(editingMaterial) : editingMaterial;
            if (editingMaterial._id) {
                // Update existing
                setForm({
                    ...form,
                    materials: form.materials.map((m: Material) =>
                        m._id === editingMaterial._id ? materialToSave : m
                    ),
                });
            } else {
                // Add new
                setForm({
                    ...form,
                    materials: [...form.materials, { ...materialToSave, order: form.materials.length + 1 }],
                });
            }
            setEditingMaterial(null);
        }
    };

    const handleMaterialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !editingMaterial) return;

        try {
            await photoUpload.run({
                title: editingMaterial.type === "photo" ? "Uploading photo..." : "Uploading file...",
                label: files.length > 1 ? `${files.length} photos` : files[0].name,
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

    const handleDeleteMaterial = (materialId: string) => {
        setForm({
            ...form,
            materials: form.materials.filter((m: Material) => m._id !== materialId),
        });
    };

    const handleMaterialDragStart = (index: number) => {
        setDraggedMaterialIndex(index);
    };

    const handleMaterialDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleMaterialDrop = (targetIndex: number) => {
        if (draggedMaterialIndex === null || draggedMaterialIndex === targetIndex) {
            setDraggedMaterialIndex(null);
            return;
        }

        setForm((prev: any) => {
            const nextMaterials = [...prev.materials];
            const [moved] = nextMaterials.splice(draggedMaterialIndex, 1);
            nextMaterials.splice(targetIndex, 0, moved);
            return {
                ...prev,
                materials: nextMaterials.map((m: Material, idx: number) => ({ ...m, order: idx + 1 })),
            };
        });
        setDraggedMaterialIndex(null);
    };

    const handleMaterialDragEnd = () => {
        setDraggedMaterialIndex(null);
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
            return;
        }

        // Add single (fallback)
        setForm((prev: any) => ({
            ...prev,
            cast: [...prev.cast, { ...editingCast, order: prev.cast.length + 1 }],
        }));
        setEditingCast(null);
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
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        
        setSaveStatus("saving");

        try {
            await photoUpload.run({
                title: "Uploading project...",
                label: "Uploading photos and assets...",
                task: async () => {
            const uploadAssetIfNeeded = async (
                asset: { url?: string; mimeType?: string; size?: number; originalName?: string },
                resourceType: "image" | "video",
                fallbackFileName: string,
            ) => {
                if (!asset?.url || !isDataUrl(asset.url)) {
                    return asset;
                }

                const uploaded = await uploadDataUrlToR2Cached(asset.url, {
                    resourceType,
                    fileName: asset.originalName || fallbackFileName,
                });

                return {
                    ...asset,
                    url: uploaded.url,
                    mimeType: uploaded.mimeType || asset.mimeType,
                    size: uploaded.size || asset.size,
                    originalName: uploaded.originalName || asset.originalName || fallbackFileName,
                };
            };

            // Extract the parent project id BEFORE deep-cloning — the option object can be a
            // fully-populated project with circular references that would make JSON.stringify throw.
            const { parentProject: _parentProject, ...cloneSource } = form;

            // Prepare data for submission (sanitize fields the server validation disallows)
            const clone = JSON.parse(JSON.stringify(cloneSource));

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

            // strip nested metadata from before/after sub-objects (server expects simple {url,label,type})
            if (Array.isArray(clone.materials)) {
                clone.materials = await Promise.all(
                    clone.materials.map(async (m: any, materialIndex: number) => {
                        const copy: any = { ...m };
                        delete copy._id;
                        delete copy.id;

                        if (isPhotoMaterialType(copy.type)) {
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

                            const [primary, ...restItems] = normalizedItems;
                            copy.url = primary?.url || copy.url;
                            copy.mimeType = primary?.mimeType || copy.mimeType;
                            copy.originalName = primary?.originalName || copy.originalName;
                            copy.size = primary?.size || copy.size;
                            copy.items = restItems;
                            copy.type = normalizedItems.length > 1 ? "bulk" : "photo";
                        }

                        if (copy.type === "video" && copy.url) {
                            const uploadedVideo = await uploadAssetIfNeeded(
                                copy,
                                "video",
                                copy.originalName || `project-video-${materialIndex + 1}.mp4`,
                            );

                            copy.url = uploadedVideo.url;
                            copy.mimeType = uploadedVideo.mimeType || copy.mimeType;
                            copy.originalName = uploadedVideo.originalName || copy.originalName;
                            copy.size = uploadedVideo.size || copy.size;

                            // upload thumbnail if present (thumbnail may be string or object)
                            const thumbAsset = typeof copy.thumbnail === 'string' ? { url: copy.thumbnail } : copy.thumbnail;
                            if (thumbAsset?.url) {
                                const uploadedThumb = await uploadAssetIfNeeded(
                                    thumbAsset,
                                    "image",
                                    thumbAsset.originalName || `project-video-thumb-${materialIndex + 1}.jpg`,
                                );

                                // store only the cloudinary URL string for backend
                                copy.thumbnail = uploadedThumb.url;
                            }
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
                                cleanItem.caption = cleanItem.caption ? toLocalizedString(cleanItem.caption) : undefined;
                                cleanItem.before = cleanItem.before ? localizeSideLabel(cleanItem.before) : cleanItem.before;
                                cleanItem.after = cleanItem.after ? localizeSideLabel(cleanItem.after) : cleanItem.after;
                                return cleanItem;
                            });
                        }

                        if (copy.caption) copy.caption = toLocalizedString(copy.caption);
                        if (copy.textContent) copy.textContent = toLocalizedString(copy.textContent);
                        if (copy.htmlContent) copy.htmlContent = toLocalizedString(copy.htmlContent);

                        return copy;
                    }),
                );

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

if (Array.isArray(clone.cast)) {
                clone.cast = await Promise.all(
                    clone.cast.map(async (c: any) => {
                        if (!c) return c;
                        if (typeof c === "string") return { castId: c };

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
                            photo = uploaded.url;
                        } else if (photo && typeof photo === "object" && !photoUrl && photo.publicId) {
                            photo = photo.publicId;
                        } else {
                            photo = null;
                        }

                        // Existing member — send its Cast id via castId so the backend references the Cast doc
                        if (c._id || c.id) {
                            const existingMember: any = { castId: c._id || c.id, order: Number(c.order) || 0 };
                            if (socialLinks.length) existingMember.socialLinks = socialLinks;
                            if (photo) existingMember.photo = photo;
                            return existingMember;
                        }
                        // New member — embed it under castId so the backend findOrCreates the Cast doc
                        const newMember: any = { name: c.name || "", title: c.title || "", order: c.order };
                        if (socialLinks.length) newMember.socialLinks = socialLinks;
                        if (photo) newMember.photo = photo;
                        return { castId: newMember, order: Number(c.order) || 0 };
                    })
                );
            }

            const submitData = {
                name: toLocalizedString(clone.name),
                description: toLocalizedString(clone.description),
                location: toLocalizedString(clone.location),
                order: clone.order,
                published: clone.published,
                categories: await resolveTaxonomyIds(clone.categories, "category"),
                tags: normalizeArrayField(clone.tags),
                types: await resolveTaxonomyIds(clone.types, "type"),
                material: clone.materials,
                cast: clone.cast,
                mainCover: clone.mainCover,
                parentProject: getOptionValue(clone.parentProject) || undefined,
                company: getOptionValue(clone.company) || undefined,
            };

            update.mutate(
                { id, data: submitData as any },
                {
                    onSuccess: () => {
                        setSaveStatus("success");
                        setTimeout(() => {
                            navigate(`/projects/${id}`);
                        }, 1500);
                    },
                    onError: () => {
                        setSaveStatus("error");
                        setTimeout(() => setSaveStatus("idle"), 3000);
                    },
                }
            );
                },
            });
        } catch (error) {
            console.error("Project submission failed:", error);
            setSaveStatus("error");
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

    const handleDelete = () => {
        if (!id) return;
        del.mutate(id, {
            onSuccess: () => navigate("/projects"),
        });
    };

    const formatRichText = (content?: string) => {
        if (!content) return "";
        return /<\/?[a-z][\s\S]*>/i.test(content) ? content : content.replace(/\n/g, "<br />");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-light-50 dark:bg-dark-950 flex items-center justify-center">
                <div className="text-center">
                    
                    <p className="text-light-600 dark:text-dark-400 font-light tracking-wide">Loading project data...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-light-50 dark:bg-dark-950 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-6">
                    <div className="w-24 h-24 mx-auto mb-6 bg-danger-50 dark:bg-danger-950/30 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-12 h-12 text-danger-500 dark:text-danger-400" />
                    </div>
                    <h2 className="text-2xl font-light mb-2 text-light-900 dark:text-dark-50">Project Not Found</h2>
                    <p className="text-light-600 dark:text-dark-400 mb-6">
                        {(error as any)?.message || "The project you're trying to edit doesn't exist."}
                    </p>
                    <Link to="/projects" className="btn-primary inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Projects
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-light-50 dark:bg-dark-950">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="relative rounded-2xl bg-light-50/5 dark:bg-dark-950/70 border border-light-100 dark:border-dark-800 p-6 lg:p-8 shadow-xl overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Link to={`/projects/${id}`} className="text-light-500 dark:text-secdark-500 hover:text-light-600 dark:hover:text-secdark-400 transition-colors">
                                        <ArrowLeft className="w-5 h-5" />
                                    </Link>
                                    <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-wider text-light-400 dark:text-dark-300">
                                        Edit Mode
                                    </span>
                                </div>
                                <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-light-900 dark:text-dark-50 leading-tight">
                                    Edit Project
                                </h1>
                                <p className="mt-2 text-sm text-light-600 dark:text-dark-400 max-w-2xl">
                                    Modify project details, materials, team, and content for "{project.name}"
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Link to={`/projects/${id}`} className="btn-ghost inline-flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Preview
                                </Link>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">Materials</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.materials.length}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">Team Members</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.cast.length}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">Categories</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.categories.length}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">Tags</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.tags.length}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 dark:bg-dark-800/40 border border-light-100 dark:border-dark-700">
                                <div className="text-xs text-light-400 dark:text-dark-400 uppercase">Types</div>
                                <div className="mt-1 text-lg font-bold text-light-700 dark:text-secdark-500">{form.types.length}</div>
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
                        Basic Info
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
                        Materials ({form.materials.length})
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
                        Cast & Crew ({form.cast.length})
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
                        Main Cover
                    </button>
                </div>
            </div>

            {/* Form Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    {/* Basic Information Tab */}
                    {activeTab === "basic" && (
                        <div className="space-y-6">
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">Basic Information</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Project Name (English) *
                                        </label>
                                        <input
                                            type="text"
                                            value={form.name?.en || ""}
                                            onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })}
                                            required
                                            className="input w-full"
                                            placeholder="Enter project name (English)"
                                        />
                                        <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Project Name (Arabic) *
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
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Description (English)
                                        </label>
                                        <textarea
                                            value={form.description?.en || ""}
                                            onChange={(e) => setForm({ ...form, description: { ...form.description, en: e.target.value } })}
                                            rows={4}
                                            className="input w-full resize-y min-h-[100px]"
                                            placeholder="Describe the project... (English)"
                                        />
                                        <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Description (Arabic)
                                        </label>
                                        <textarea
                                            dir="rtl"
                                            value={form.description?.ar || ""}
                                            onChange={(e) => setForm({ ...form, description: { ...form.description, ar: e.target.value } })}
                                            rows={4}
                                            className="input w-full resize-y min-h-[100px]"
                                            placeholder="وصف المشروع (بالعربية)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Location (English)
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-400 dark:text-dark-500" />
                                            <input
                                                type="text"
                                                value={form.location?.en || ""}
                                                onChange={(e) => setForm({ ...form, location: { ...form.location, en: e.target.value } })}
                                                className="input w-full pl-9"
                                                placeholder="e.g., Cairo, Egypt"
                                            />
                                        </div>
                                        <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Location (Arabic)
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
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Parent Project
                                        </label>
                                        <Autocomplete
                                            options={allProjects.filter((p: any) => ((p.id || p._id) !== id))}
                                            value={form.parentProject || null}
                                            onChange={(_, v) => setForm({ ...form, parentProject: v })}
                                            getOptionLabel={(opt) => getOptionLabel(opt)}
                                            isOptionEqualToValue={(o: any, v: any) => {
                                                const oId = (o && (o._id || o.id)) || "";
                                                const vId = (v && (v._id || v.id)) || "";
                                                if (oId && vId) return String(oId) === String(vId);
                                                return getOptionLabel(o) === getOptionLabel(v);
                                            }}
                                            renderInput={(params) => <TextField {...params} placeholder="Optional parent project" size="small" />}
                                            sx={taxonomyAutocompleteSx}
                                            slotProps={taxonomyAutocompleteSlotProps}
                                        />
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Order
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={form.order}
                                            onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                                            className="input w-full"
                                            placeholder="Project order (1, 2, 3...)"
                                        />
                                        <p className="mt-1 text-xs text-light-500 dark:text-dark-400">
                                            Determines the display order of this project.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <input
                                            type="checkbox"
                                            name="published"
                                            id="published"
                                            checked={form.published}
                                            onChange={handleChange}
                                            className="w-4 h-4 rounded border-light-300 dark:border-dark-600 text-light-500 dark:text-secdark-500 focus:ring-light-500 dark:focus:ring-secdark-500"
                                        />
                                        <label htmlFor="published" className="text-sm text-light-700 dark:text-dark-300">
                                            Publish this project (make it publicly visible)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">Categories & Tags</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Project Company
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
                                            renderInput={(params) => <TextField {...params} placeholder="Select project company" size="small" />}
                                            sx={taxonomyAutocompleteSx}
                                            slotProps={taxonomyAutocompleteSlotProps}
                                        />

                                        <div className="mt-4 border-t border-light-200 dark:border-dark-700 pt-4">
                                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-light-500 dark:text-dark-400">
                                                Or create a new company
                                            </p>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <input
                                                    type="text"
                                                    value={newCompanyEn}
                                                    onChange={(e) => setNewCompanyEn(e.target.value)}
                                                    className="input w-full"
                                                    placeholder="Company name (EN)..."
                                                />
                                                <input
                                                    type="text"
                                                    dir="rtl"
                                                    value={newCompanyAr}
                                                    onChange={(e) => setNewCompanyAr(e.target.value)}
                                                    className="input w-full"
                                                    placeholder="Company name (AR)..."
                                                />
                                                <input
                                                    type="text"
                                                    value={newCompanyField}
                                                    onChange={(e) => setNewCompanyField(e.target.value)}
                                                    className="input w-full"
                                                    placeholder="Field (e.g. Production)..."
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
                                                        alt="Company logo"
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
                                                    Add Company
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            Categories
                                        </label>
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
                                            <option value="">Select existing category...</option>
                                            {projectCategoriesLoading ? (
                                                <option value="" disabled>Loading categories...</option>
                                            ) : (
                                                projectCategories.map((c: any, idx: number) => (
                                                    <option key={idx} value={idx}>{getOptionLabel(c)}</option>
                                                ))
                                            )}
                                        </select>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add the category (EN)..."
                                            />
                                            <input
                                                type="text"
                                                dir="rtl"
                                                value={newCategoryAr}
                                                onChange={(e) => setNewCategoryAr(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add the category (AR)..."
                                            />
                                            <button type="button" onClick={handleAddCategory} className="btn-secondary">Add</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Tags</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {form.tags.map((tag: any, idx: number) => (
                                                <span key={getOptionValue(tag) || `${getOptionLabel(tag)}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-light-100 dark:bg-dark-800 text-light-700 dark:text-dark-300 rounded-md text-sm">
                                                    #{getOptionLabel(tag)}
                                                    {tag && typeof tag === "object" && tag.ar && tag.ar.trim() ? (
                                                        <span className="opacity-70"> / #{tag.ar}</span>
                                                    ) : null}
                                                    <button type="button" onClick={() => handleRemoveTag(tag)}>
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newTag}
                                                onChange={(e) => setNewTag(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add a tag (EN)..."
                                            />
                                            <input
                                                type="text"
                                                dir="rtl"
                                                value={newTagAr}
                                                onChange={(e) => setNewTagAr(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add the tag (AR)..."
                                            />
                                            <button type="button" onClick={handleAddTag} className="btn-secondary">Add</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Project Types</label>
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
                                            <option value="">Select existing type...</option>
                                            {projectTypesLoading ? (
                                                <option value="" disabled>Loading types...</option>
                                            ) : (
                                                projectTypes.map((t: any, idx: number) => (
                                                    <option key={idx} value={idx}>{getOptionLabel(t)}</option>
                                                ))
                                            )}
                                        </select>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newType}
                                                onChange={(e) => setNewType(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddType())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add the type (EN)..."
                                            />
                                            <input
                                                type="text"
                                                dir="rtl"
                                                value={newTypeAr}
                                                onChange={(e) => setNewTypeAr(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddType())}
                                                data-enter-add
                                                className="input flex-1"
                                                placeholder="Add the type (AR)..."
                                            />
                                            <button type="button" onClick={handleAddType} className="btn-secondary">Add</button>
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
                                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">Materials & Media</h2>
                                    <button type="button" onClick={handleAddMaterial} className="btn-primary inline-flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Add Material
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {form.materials.map((material: Material, idx: number) => (
                                        <div
                                            key={material._id || idx}
                                            onDragOver={handleMaterialDragOver}
                                            onDrop={() => handleMaterialDrop(idx)}
                                            className={`border border-light-200 dark:border-dark-700 rounded-lg p-3 transition-shadow hover:bg-light-50 dark:hover:bg-dark-800/30 ${draggedMaterialIndex === idx ? "opacity-60" : "hover:shadow-md"}`}
                                        >
                                            <div className="w-full grid grid-cols-12 gap-4 items-start">
                                                    <div className="col-span-12 sm:col-span-1 flex sm:justify-center">
                                                        <button
                                                            type="button"
                                                            draggable
                                                            onDragStart={() => handleMaterialDragStart(idx)}
                                                            onDragEnd={handleMaterialDragEnd}
                                                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 text-light-500 dark:text-dark-400 cursor-grab active:cursor-grabbing"
                                                            title="Drag to reorder"
                                                            aria-label="Drag material to reorder"
                                                        >
                                                            <GripVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="col-span-12 sm:col-span-2">
                                                        <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/5">
                                                            {material.type === "before_after" ? (
                                                                <BeforeAfterSlider
                                                                    beforeUrl={material.before?.url}
                                                                    afterUrl={material.after?.url}
                                                                    beforeLabel={localizedToString(material.before?.label) || "Before"}
                                                                    afterLabel={localizedToString(material.after?.label) || "After"}
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
                                                                                <Image className="w-6 h-6 opacity-40" />
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (previewItems.length === 1) {
                                                                        return <img src={previewItems[0].url} alt={localizedToString(material.caption) || ''} className="w-full h-full object-cover" />;
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
                                                            ) : material.type === "video" && material.url ? (
                                                                <video src={material.url} controls className="w-full h-full object-cover" />
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
                                                                    <Image className="w-6 h-6 opacity-40" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-12 sm:col-span-7">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold bg-light-100 dark:bg-dark-800 text-danger-400">
                                                                    {material.type === "photo" && <Image className="w-4 h-4" />}
                                                                    {material.type === "video" && <Video className="w-4 h-4" />}
                                                                    {material.type === "before_after" && <Camera className="w-4 h-4" />}
                                                                    {material.type === "text" && <FileText className="w-4 h-4" />}
                                                                    {material.type === "html" && <Code className="w-4 h-4" />}
                                                                    <span className="uppercase">{material.type}</span>
                                                                    <span className="font-mono ml-1">#{material.order}</span>
                                                                </span>

                                                                <div className="truncate">
                                                                    {localizedToString(material.caption) && <div className="text-sm font-medium text-light-900 dark:text-dark-50 truncate">{localizedToString(material.caption)}</div>}
                                                                </div>
                                                            </div>

                                                          
                                                        </div>

                                                        {material.type === "photo" && (
                                                            (() => {
                                                                const photoItems = buildPhotoItems(material);
                                                                const primarySize = photoItems[0]?.size || material.size;

                                                                return (
                                                                    <div className="mt-2 text-xs text-light-500 dark:text-dark-400">
                                                                        {photoItems.length > 0
                                                                            ? `${photoItems.length} ${photoItems.length === 1 ? "photo" : "photos"} grouped`
                                                                            : (material.originalName ? `File: ${material.originalName}` : "Uploaded image")}
                                                                        {primarySize ? ` • ${((primarySize || 0) / 1024).toFixed(1)}KB` : ""}
                                                                    </div>
                                                                );
                                                            })()
                                                        )}

                                                       

                                                        {material.textContent && (
                                                            <div className="mt-2">
                                                                <div
                                                                    className="p-3 bg-light-100 dark:bg-dark-800 rounded-md text-sm text-light-700 dark:text-dark-300 max-h-28 overflow-auto break-words"
                                                                    dangerouslySetInnerHTML={{ __html: formatRichText(localizedToString(material.textContent)) }}
                                                                >
                                                                </div>
                                                            </div>
                                                        )}

                                                        {material.htmlContent && (
                                                            <div className="mt-2">
                                                                <div className="p-3 bg-light-100 dark:bg-dark-800 rounded-md text-sm text-light-700 dark:text-dark-300 max-h-28 overflow-auto">
                                                                    <pre className="whitespace-pre-wrap text-xs break-words">{localizedToString(material.htmlContent)}</pre>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="col-span-12 sm:col-span-2 sm:ml-auto flex items-center justify-end gap-2">
                                                        <button type="button" onClick={() => handleEditMaterial(material)} title="Edit" aria-label="Edit material" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 hover:bg-light-100 dark:hover:bg-dark-800 text-light-600 dark:text-dark-400 transition-colors">
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button type="button" onClick={() => handleDeleteMaterial(material._id!)} title="Delete" aria-label="Delete material" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-danger-200 dark:border-danger-900/40 bg-white/70 dark:bg-dark-900/50 hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                            </div>
                                        </div>
                                    ))}
                                    {form.materials.length === 0 && (
                                        <div className="text-center py-8 text-light-500 dark:text-dark-400">
                                            No materials yet. Click "Add Material" to get started.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cast Tab */}
                    {activeTab === "cast" && (
                        <div className="space-y-6">
                            <div className="card p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">Cast & Crew</h2>
                                    <button type="button" onClick={handleAddCast} className="btn-primary inline-flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Add Member
                                    </button>
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
                                            className={`border border-light-200 dark:border-dark-700 rounded-lg p-4 transition-all cursor-grab active:cursor-grabbing hover:shadow-md hover:bg-light-50 dark:hover:bg-dark-800/30 ${
                                                draggedCastIndex === idx
                                                    ? "opacity-60 ring-2 ring-light-400 dark:ring-secdark-500"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-light-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/40 text-light-500 dark:text-dark-400">
                                                        <GripVertical className="w-4 h-4" />
                                                    </span>
                                                    {(() => {
                                                        const memberPhotoUrl = getCastPhotoUrl(member.photo);
                                                        if (memberPhotoUrl) {
                                                            return <img src={memberPhotoUrl} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-light-200 dark:border-dark-700" />;
                                                        }
                                                        return (
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-light-200 to-light-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-light-700 dark:text-dark-300 font-semibold">
                                                                {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                                                            </div>
                                                        );
                                                    })()}
<div>
                                                            <div className="flex items-center gap-3">
                                                                <h3 className="font-semibold text-light-900 dark:text-dark-50">{member.name}</h3>
                                                                {member.title && <span className="text-sm text-secdark-500">{member.title}</span>}
                                                            </div>
                                                            <div className="mt-1.5">
                                                                <SocialLinkIcons links={member.socialLinks} size={14} className="!gap-1.5" />
                                                                <div className="text-xs text-light-400 dark:text-dark-500 mt-1">Order: {member.order}</div>
                                                            </div>
                                                        </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button type="button" onClick={() => handleEditCast(member, idx)} title="Edit" aria-label="Edit cast member" className="p-2 rounded-lg hover:bg-light-100 dark:hover:bg-dark-800 text-light-600 dark:text-dark-400 transition-colors">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteCast(idx)} title="Delete" aria-label="Delete cast member" className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/30 text-danger-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {form.cast.length === 0 && (
                                        <div className="text-center py-8 text-light-500 dark:text-dark-400">
                                            No team members yet. Click "Add Member" to add cast or crew.
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
                                <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50 mb-4">Main Cover Image</h2>
                                
                                {form.mainCover ? (
                                    <div className="space-y-4">
                                        <div className="rounded-lg overflow-hidden border border-light-200 dark:border-dark-700">
                                            <img src={form.mainCover.url} alt="Main Cover" className="w-full h-auto max-h-[400px] object-contain" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-light-500 dark:text-dark-400">File Name:</span>
                                                <span className="ml-2 text-light-900 dark:text-dark-50">{form.mainCover.originalName}</span>
                                            </div>
                                         
                                            <div>
                                                <span className="text-light-500 dark:text-dark-400">Size:</span>
                                                <span className="ml-2 text-light-900 dark:text-dark-50">
                                                    {form.mainCover.size ? `${(form.mainCover.size / 1024).toFixed(2)} KB` : "N/A"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="btn-secondary"
                                            >
                                                <Upload className="w-4 h-4 inline mr-2" />
                                                Replace Image
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveMainCover}
                                                className="btn-danger"
                                            >
                                                <Trash2 className="w-4 h-4 inline mr-2" />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed border-light-200 dark:border-dark-700 rounded-lg">
                                        <Camera className="w-12 h-12 text-light-400 dark:text-dark-500 mx-auto mb-3" />
                                        <p className="text-light-600 dark:text-dark-400 mb-4">No main cover image set</p>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="btn-primary"
                                        >
                                            <Upload className="w-4 h-4 inline mr-2" />
                                            Upload Cover Image
                                        </button>
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
                        <div>
                            {!showDeleteConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="btn-danger inline-flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Project
                                </button>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-danger-600 dark:text-danger-400">
                                        Are you sure?
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={del.isPending}
                                        className="btn-danger inline-flex items-center gap-2"
                                    >
                                        {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Yes, Delete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <Link to={`/projects/${id}`} className="btn-ghost">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={update.isPending || saveStatus === "saving"}
                                className="btn-primary inline-flex items-center gap-2 min-w-[120px] justify-center"
                            >
                                {saveStatus === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
                                {saveStatus === "success" && <CheckCircle className="w-4 h-4" />}
                                {saveStatus === "error" && <AlertCircle className="w-4 h-4" />}
                                {saveStatus === "idle" && <Save className="w-4 h-4" />}
                                {saveStatus === "saving" && "Saving..."}
                                {saveStatus === "success" && "Saved!"}
                                {saveStatus === "error" && "Failed!"}
                                {saveStatus === "idle" && "Save Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Upload Progress Overlay */}
            <UploadProgressOverlay
                open={photoUpload.open}
                progress={photoUpload.progress}
                estimatedSecondsLeft={photoUpload.estimatedSecondsLeft}
                title={photoUpload.title}
                label={photoUpload.label}
            />

            {/* Material Edit Modal */}
            {editingMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingMaterial(null)}>
                    <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-light-200 dark:border-dark-700 p-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-light-900 dark:text-dark-50">
                                {editingMaterial._id ? "Edit Material" : "Add Material"}
                            </h3>
                            <button onClick={() => setEditingMaterial(null)} className="p-1 hover:bg-light-100 dark:hover:bg-dark-700 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Type</label>
                                <select
                                    value={editingMaterial.type}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, type: e.target.value as any })}
                                    className="input w-full"
                                >
                                    <option value="photo">Photo</option>
                                    <option value="video">Video</option>
                                    <option value="before_after">Before/After</option>
                                    <option value="text">Text</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Title (English)</label>
                                <input                                    type="text"
                                    value={editingMaterial.caption?.en || ""}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, caption: { ...editingMaterial.caption, en: e.target.value } })}
                                    className="input w-full"
                                    placeholder="Optional caption (English)"
                                />
                                <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Title (Arabic)</label>
                                <input                                    type="text"
                                    dir="rtl"
                                    value={editingMaterial.caption?.ar || ""}
                                    onChange={(e) => setEditingMaterial({ ...editingMaterial, caption: { ...editingMaterial.caption, ar: e.target.value } })}
                                    className="input w-full"
                                    placeholder="عنوان اختياري (بالعربية)"
                                />
                            </div>

                            {(editingMaterial.type === "photo" || editingMaterial.type === "video") && (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">
                                            {editingMaterial.type === "photo" ? "Upload photos" : "Upload file"}
                                        </label>
                                        <input
                                            type="file"
                                            accept={editingMaterial.type === "photo" ? "image/*" : "video/*"}
                                            multiple={editingMaterial.type === "photo"}
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
                                                    {groupedPhotoItems.length} {groupedPhotoItems.length === 1 ? "photo" : "photos"} grouped under this title
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {groupedPhotoItems.map((item, itemIndex) => (
                                                        <div key={`${item.originalName || "photo"}-${itemIndex}`} className="relative group overflow-hidden rounded border border-light-200 dark:border-dark-700">
                                                            <img src={item.url} alt={item.originalName || `Photo ${itemIndex + 1}`} className="w-full h-28 object-cover" />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePhotoItem(itemIndex)}
                                                                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Remove photo"
                                                                aria-label="Remove photo"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {editingMaterial.type === "video" && editingMaterial.url && (
                                        <div className="mt-3">
                                            <video src={editingMaterial.url} controls className="w-full h-40 object-cover rounded" />
                                        </div>
                                    )}
                                    {editingMaterial.type === "video" && (
                                        <div className="mt-3">
                                            <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Video Thumbnail (optional)</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleVideoThumbnailUpload}
                                                className="input w-full"
                                            />

                                            {(() => {
                                                const thumbUrl = typeof editingMaterial.thumbnail === 'string' ? editingMaterial.thumbnail : editingMaterial.thumbnail?.url;
                                                const thumbName = typeof editingMaterial.thumbnail === 'object' ? editingMaterial.thumbnail?.originalName : undefined;
                                                if (!thumbUrl) return null;

                                                return (
                                                    <div className="mt-3">
                                                        <img src={thumbUrl} alt="Thumbnail preview" className="w-full h-40 object-cover rounded" />
                                                        <div className="mt-2 text-xs text-light-500 dark:text-dark-400">File: {thumbName || 'Uploaded image'}</div>
                                                        <div className="mt-2">
                                                            <button type="button" onClick={() => setEditingMaterial(prev => prev ? { ...prev, thumbnail: undefined } : prev)} className="btn-ghost">Remove</button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </>
                            )}

                            {editingMaterial.type === "text" && (
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Text Content (English)</label>
                                    <div className="project-quill rounded-xl overflow-hidden border border-light-200 dark:border-dark-700">
                                        <ReactQuill
                                            theme="snow"
                                            value={editingMaterial.textContent?.en || ""}
                                            onChange={(value) => setEditingMaterial({ ...editingMaterial, textContent: { ...editingMaterial.textContent, en: value } })}
                                        />
                                    </div>
                                    <label className="block mt-3 mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Text Content (Arabic)</label>
                                    <div className="project-quill rounded-xl overflow-hidden border border-light-200 dark:border-dark-700">
                                        <ReactQuill
                                            theme="snow"
                                            value={editingMaterial.textContent?.ar || ""}
                                            onChange={(value) => setEditingMaterial({ ...editingMaterial, textContent: { ...editingMaterial.textContent, ar: value } })}
                                        />
                                    </div>
                                </div>
                            )}

                           
                            {editingMaterial.type === "before_after" && (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Before Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleBeforeAfterUpload(e, 'before')}
                                            className="input w-full"
                                        />

                                        {editingMaterial.before?.url && (
                                            <div className="mt-3">
                                                <img src={editingMaterial.before.url} alt="Before preview" className="w-full h-40 object-cover rounded" />
                                                <div className="mt-2 text-xs text-light-500 dark:text-dark-400">File: {editingMaterial.before.originalName || 'Uploaded image'}</div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mt-3">
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
                                                placeholder="Before label (EN)"
                                            />
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
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">After Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleBeforeAfterUpload(e, 'after')}
                                            className="input w-full"
                                        />

                                        {editingMaterial.after?.url && (
                                            <div className="mt-3">
                                                <img src={editingMaterial.after.url} alt="After preview" className="w-full h-40 object-cover rounded" />
                                                <div className="mt-2 text-xs text-light-500 dark:text-dark-400">File: {editingMaterial.after.originalName || 'Uploaded image'}</div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mt-3">
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
                                                placeholder="After label (EN)"
                                            />
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
                                        </div>
                                    </div>

                                </>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setEditingMaterial(null)} className="btn-ghost">Cancel</button>
                                <button onClick={handleSaveMaterial} className="btn-primary">Save Material</button>
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
                                {castModalMode === "edit" ? "Edit Team Member" : "Add Team Member"}
                            </h3>
                            <button onClick={() => setEditingCast(null)} className="p-1 hover:bg-light-100 dark:hover:bg-dark-700 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {castModalMode === "edit" ? (
                                <>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Name</label>
                                        <input
                                            type="text"
                                            value={editingCast.name}
                                            onChange={(e) => setEditingCast({ ...editingCast, name: e.target.value })}
                                            className="input w-full"
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Title/Role</label>
                                        <input
                                            type="text"
                                            value={editingCast.title}
                                            onChange={(e) => setEditingCast({ ...editingCast, title: e.target.value })}
                                            className="input w-full"
                                            placeholder="e.g., Creative Director, Photographer"
                                        />
                                    </div>
                                    <CastSocialLinks
                                        value={editingCast.socialLinks || []}
                                        onChange={(links) => setEditingCast({ ...editingCast, socialLinks: links })}
                                    />
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Photo</label>
                                        {(() => {
                                            const photoUrl = getCastPhotoUrl(editingCast.photo);
                                            if (photoUrl) {
                                                return (
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <img src={photoUrl} alt={editingCast.name || "Member"} className="w-16 h-16 rounded-full object-cover border border-light-200 dark:border-dark-700" />
                                                        <button type="button" onClick={() => setEditingCast({ ...editingCast, photo: null })} className="btn-ghost">Remove</button>
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
                                    <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Members</label>
                                    <p className="text-xs text-light-500 dark:text-dark-400 mb-2">Select existing members or add new ones below. Use <span className="font-medium">Add Member</span> to append rows.</p>

                                    <Autocomplete
                                        multiple
                                        disablePortal
                                        filterSelectedOptions
                                        options={projectCast.filter(
                                            (pc: any) => !form.cast.some(
                                                (c: any) => (c._id || c.id) && (c._id || c.id) === (pc._id || pc.id)
                                            )
                                        )}
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
                                        renderInput={(params) => <TextField {...params} placeholder="Search existing members" size="small" />}
                                    />

                                    {newMembersRows.map((row, rIdx) => (
                                        <div key={rIdx} className="mb-3">
                                            <div className="grid grid-cols-12 gap-2 items-center mb-2">
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={(e) => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, name: e.target.value } : p)))}
                                                    className="input col-span-7"
                                                    placeholder="Full name"
                                                />
                                                <input
                                                    type="text"
                                                    value={row.title}
                                                    onChange={(e) => setNewMembersRows((prev) => prev.map((p, i) => (i === rIdx ? { ...p, title: e.target.value } : p)))}
                                                    className="input col-span-4"
                                                    placeholder="Title/Role (optional)"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setNewMembersRows((prev) => prev.filter((_, i) => i !== rIdx))}
                                                    className="p-2 rounded hover:bg-light-100 dark:hover:bg-dark-800 text-danger-500"
                                                    title="Remove"
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
                                                                    Remove
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
                                            Add Member
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setEditingCast(null)} className="btn-ghost">Cancel</button>
                                <button onClick={handleSaveCast} className="btn-primary">{castModalMode === "edit" ? "Save Member" : "Save Members"}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditProject;