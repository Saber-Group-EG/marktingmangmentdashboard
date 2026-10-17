import { captureVideoThumbnail } from "@/utils/videoThumbnail";
import type { StoryMaterial } from "@/api/interfaces/storyGroupInterface";
import type { ProjectVideoCandidate } from "./projectSource";

export interface DraftVideoItem {
    /** Stable dnd-kit id, unique per row. */
    key: string;
    /** Remote http(s) URL; empty while a freshly picked file is still pending upload. */
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    /** Remote URL, or a local data URL awaiting upload. */
    thumbnail?: string;
    /** Local file to upload before submit. */
    file?: File;
    /** Object URL used to preview a local file. */
    previewUrl?: string;
    source: "project" | "upload";
}

export interface ResolvedUpload {
    url: string;
    thumbnail?: string;
}

let draftSequence = 0;

const nextDraftKey = (): string => {
    draftSequence += 1;
    return `story-video-${Date.now().toString(36)}-${draftSequence}`;
};

export const isHttpUrl = (value?: string): value is string => /^https?:\/\//i.test((value || "").trim());

export const isPendingUpload = (item: DraftVideoItem): item is DraftVideoItem & { file: File } => !!item.file && !isHttpUrl(item.url);

export const createProjectDraftItem = (candidate: ProjectVideoCandidate): DraftVideoItem => {
    const item: DraftVideoItem = {
        key: nextDraftKey(),
        url: candidate.url,
        source: "project",
    };
    if (candidate.mimeType) item.mimeType = candidate.mimeType;
    if (candidate.size !== undefined) item.size = candidate.size;
    if (candidate.originalName) item.originalName = candidate.originalName;
    if (candidate.thumbnail) item.thumbnail = candidate.thumbnail;
    return item;
};

export const createUploadDraftItem = async (file: File): Promise<DraftVideoItem> => {
    const thumbnail = await captureVideoThumbnail(file);
    const item: DraftVideoItem = {
        key: nextDraftKey(),
        url: "",
        file,
        previewUrl: URL.createObjectURL(file),
        source: "upload",
    };
    if (file.type) item.mimeType = file.type;
    item.size = file.size;
    item.originalName = file.name;
    if (thumbnail) item.thumbnail = thumbnail;
    return item;
};

export const releaseDraftItem = (item: DraftVideoItem): void => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
};

export const getItemLabel = (item: DraftVideoItem, fallback: string): string => (item.originalName || "").trim() || item.url || fallback;

export const buildStoryMaterials = (items: DraftVideoItem[], resolved: Map<string, ResolvedUpload>): StoryMaterial[] =>
    items
        .map((item, index): StoryMaterial | null => {
            const upload = resolved.get(item.key);
            const url = (upload?.url || item.url).trim();
            if (!isHttpUrl(url)) return null;

            const thumbnailSource = upload?.thumbnail ?? item.thumbnail;
            const thumbnail = isHttpUrl(thumbnailSource) ? thumbnailSource : undefined;

            const material: StoryMaterial = { type: "video", url, order: index };
            if (item.mimeType) material.mimeType = item.mimeType;
            if (item.size !== undefined) material.size = item.size;
            if (item.originalName) material.originalName = item.originalName;
            if (thumbnail) material.thumbnail = thumbnail;
            return material;
        })
        .filter((material): material is StoryMaterial => material !== null)
        .map((material, index) => ({ ...material, order: index }));
