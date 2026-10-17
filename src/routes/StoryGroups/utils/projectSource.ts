import type { Project } from "@/api/interfaces/projectInterface";
import type { StoryGroup, StoryGroupCover, StoryLocalizedText } from "@/api/interfaces/storyGroupInterface";

// transformProject keeps the raw localized payload at runtime but the Project
// type does not declare it, so widen it structurally for this feature only.
export type ProjectSource = Project & {
    localizedName?: unknown;
    coverImage?: unknown;
};

export interface ProjectVideoCandidate {
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    thumbnail?: string;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const isVideoType = (value: unknown): boolean => value === "video";

const isVideoMime = (value: unknown): boolean => typeof value === "string" && value.startsWith("video/");

const readOrder = (value: UnknownRecord | null): number => {
    const order = value?.order;
    return typeof order === "number" && Number.isFinite(order) ? order : 0;
};

const readThumbnail = (value: UnknownRecord): string | undefined => {
    const thumbnail = asString(value.thumbnail).trim();
    if (thumbnail) return thumbnail;
    const nested = asRecord(value.thumbnail);
    return nested ? asString(nested.url).trim() || undefined : undefined;
};

const toCandidate = (record: UnknownRecord, inheritedMime?: unknown): ProjectVideoCandidate | null => {
    const url = asString(record.url).trim();
    if (!url) return null;

    const candidate: ProjectVideoCandidate = { url };
    const mimeType = asString(record.mimeType).trim() || asString(inheritedMime).trim();
    if (mimeType) candidate.mimeType = mimeType;
    if (typeof record.size === "number" && Number.isFinite(record.size)) candidate.size = record.size;
    const originalName = asString(record.originalName).trim();
    if (originalName) candidate.originalName = originalName;
    const thumbnail = readThumbnail(record);
    if (thumbnail) candidate.thumbnail = thumbnail;
    return candidate;
};

/**
 * Flattens `project.material` into a de-duplicated list of video entries:
 * top level entries typed `video` (or with a video mime type) plus every entry
 * nested inside an `items[]` group that looks like a video — the same shape
 * PreviewProject uses to render a project's videos.
 */
export const extractProjectVideoItems = (materials: unknown): ProjectVideoCandidate[] => {
    if (!Array.isArray(materials)) return [];

    const sorted = [...materials].sort((a, b) => readOrder(asRecord(a)) - readOrder(asRecord(b)));
    const merged: ProjectVideoCandidate[] = [];

    sorted.forEach((rawMaterial) => {
        const material = asRecord(rawMaterial);
        if (!material) return;

        const children = Array.isArray(material.items) ? material.items.map(asRecord).filter((child): child is UnknownRecord => child !== null) : [];

        const parentIsVideo =
            isVideoType(material.type) ||
            isVideoMime(material.mimeType) ||
            (material.type === "bulk" && children.some((child) => isVideoType(child.type) || isVideoMime(child.mimeType)));

        if (material.url && parentIsVideo) {
            const candidate = toCandidate(material);
            if (candidate) merged.push(candidate);
        }

        children.forEach((child) => {
            // Photos must never become video candidates, even inside a bulk
            // group whose parent qualifies as video.
            if (child.type === "photo") return;
            if (!parentIsVideo && !isVideoType(child.type) && !isVideoMime(child.mimeType)) return;
            const candidate = toCandidate(child, parentIsVideo ? material.mimeType : undefined);
            if (candidate) merged.push(candidate);
        });
    });

    const seen = new Set<string>();
    return merged.filter((candidate) => {
        if (seen.has(candidate.url)) return false;
        seen.add(candidate.url);
        return true;
    });
};

export const getProjectLocalizedTitle = (project: Project): { ar: string; en: string } => {
    const source = project as ProjectSource;
    const raw = asRecord(source.localizedName);
    const ar = raw ? asString(raw.ar).trim() : "";
    const en = raw ? asString(raw.en).trim() : "";
    const plain = asString(project.name).trim();

    if (ar && en) return { ar, en };
    if (ar) return { ar, en: en || ar || plain };
    if (en) return { ar: ar || en || plain, en };
    return { ar: plain, en: plain };
};

export const getProjectCoverUrl = (project: Project): string => {
    const source = project as ProjectSource;
    const fromCoverImage = asString(asRecord(source.coverImage)?.url).trim();
    return asString(project.mainCover?.url).trim() || asString(project.fullMainCover?.url).trim() || fromCoverImage;
};

export const storyGroupTitleForLang = (title: StoryGroup["title"], lang: "en" | "ar"): string => {
    const primary = lang === "ar" ? title.ar : title.en;
    const fallback = lang === "ar" ? title.en : title.ar;
    return (primary || fallback || "").trim();
};

export const toSubtitlePayload = (subtitle: StoryLocalizedText): StoryLocalizedText | undefined => {
    const payload: StoryLocalizedText = {};
    const ar = (subtitle.ar || "").trim();
    const en = (subtitle.en || "").trim();
    if (ar) payload.ar = ar;
    if (en) payload.en = en;
    return payload.ar || payload.en ? payload : undefined;
};

export const toCoverPayload = (cover: StoryGroupCover): StoryGroupCover | undefined => {
    const url = (cover.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return undefined;
    const payload: StoryGroupCover = { url };
    if (cover.mimeType) payload.mimeType = cover.mimeType;
    if (typeof cover.size === "number") payload.size = cover.size;
    if (cover.originalName) payload.originalName = cover.originalName;
    return payload;
};
