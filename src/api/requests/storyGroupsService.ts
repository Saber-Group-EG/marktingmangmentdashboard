import axiosInstance from "../axios";
import type {
    StoryGroup,
    StoryGroupCover,
    StoryGroupCreate,
    StoryGroupUpdate,
    StoryLocalizedText,
    StoryMaterial,
} from "../interfaces/storyGroupInterface";

const STORY_GROUPS_ENDPOINT = "/story-groups";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asOptionalString = (value: unknown): string | undefined => {
    const text = asString(value).trim();
    return text || undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const ARRAY_KEYS = ["data", "storyGroups", "groups", "results", "items", "list"];

const pickArray = (source: unknown, keys: string[]): unknown[] | null => {
    const record = asRecord(source);
    if (!record) return null;
    for (const key of keys) {
        const value = record[key];
        if (Array.isArray(value)) return value;
    }
    return null;
};

const extractArrayFromResponse = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;
    return pickArray(payload, ARRAY_KEYS) ?? pickArray(asRecord(payload)?.data, ARRAY_KEYS) ?? [];
};

const extractSingleFromResponse = (payload: unknown): unknown => {
    const record = asRecord(payload);
    if (!record) return payload;
    const nested = asRecord(record.data);
    return record.storyGroup ?? record.group ?? nested?.storyGroup ?? nested?.group ?? record.data ?? payload;
};

const normalizeLocalizedText = (value: unknown): StoryLocalizedText | undefined => {
    if (typeof value === "string") {
        const text = value.trim();
        if (!text) return undefined;
        return { ar: text, en: text };
    }
    const record = asRecord(value);
    if (!record) return undefined;
    const localized: StoryLocalizedText = {};
    const ar = asOptionalString(record.ar);
    const en = asOptionalString(record.en);
    if (ar) localized.ar = ar;
    if (en) localized.en = en;
    return localized.ar || localized.en ? localized : undefined;
};

const normalizeTitle = (value: unknown): { ar: string; en: string } => {
    if (typeof value === "string") {
        const text = value.trim();
        return { ar: text, en: text };
    }
    const localized = normalizeLocalizedText(value);
    return { ar: localized?.ar || "", en: localized?.en || "" };
};

const normalizeThumbnail = (value: unknown): string | undefined => {
    if (typeof value === "string") return asOptionalString(value);
    return asOptionalString(asRecord(value)?.url);
};

const normalizeMaterial = (value: unknown): StoryMaterial | null => {
    const record = asRecord(value);
    if (!record) return null;
    const url = asString(record.url).trim();
    if (!url) return null;

    const material: StoryMaterial = {
        type: record.type === "video" ? "video" : "photo",
        url,
    };
    const mimeType = asOptionalString(record.mimeType);
    if (mimeType) material.mimeType = mimeType;
    const size = asOptionalNumber(record.size);
    if (size !== undefined) material.size = size;
    const originalName = asOptionalString(record.originalName);
    if (originalName) material.originalName = originalName;
    const thumbnail = normalizeThumbnail(record.thumbnail);
    if (thumbnail) material.thumbnail = thumbnail;
    const caption = normalizeLocalizedText(record.caption);
    if (caption) material.caption = caption;
    const order = asOptionalNumber(record.order);
    if (order !== undefined) material.order = order;

    return material;
};

const normalizeCover = (value: unknown): StoryGroupCover | undefined => {
    const record = asRecord(value);
    if (!record) return undefined;
    const cover: StoryGroupCover = {};
    const url = asOptionalString(record.url);
    if (url) cover.url = url;
    const mimeType = asOptionalString(record.mimeType);
    if (mimeType) cover.mimeType = mimeType;
    const size = asOptionalNumber(record.size);
    if (size !== undefined) cover.size = size;
    const originalName = asOptionalString(record.originalName);
    if (originalName) cover.originalName = originalName;
    return cover.url || cover.mimeType || cover.originalName ? cover : undefined;
};

const normalizeStoryGroup = (value: unknown): StoryGroup => {
    const record = asRecord(value);
    if (!record) return { title: { ar: "", en: "" } };

    const group: StoryGroup = {
        title: normalizeTitle(record.title),
    };

    const id = asOptionalString(record._id) || asOptionalString(record.id);
    if (id) {
        group._id = id;
        group.id = id;
    }

    const subtitle = normalizeLocalizedText(record.subtitle);
    if (subtitle) group.subtitle = subtitle;

    const coverImage = normalizeCover(record.coverImage);
    if (coverImage) group.coverImage = coverImage;

    if (Array.isArray(record.material)) {
        group.material = record.material.map(normalizeMaterial).filter((item): item is StoryMaterial => item !== null);
    }

    const order = asOptionalNumber(record.order);
    if (order !== undefined) group.order = order;

    if (record.deleted === true) group.deleted = true;

    const createdAt = asOptionalString(record.createdAt);
    if (createdAt) group.createdAt = createdAt;
    const updatedAt = asOptionalString(record.updatedAt);
    if (updatedAt) group.updatedAt = updatedAt;

    return group;
};

export const getStoryGroups = async (): Promise<StoryGroup[]> => {
    const response = await axiosInstance.get(STORY_GROUPS_ENDPOINT, { params: { PageCount: "all" } });
    return extractArrayFromResponse(response.data)
        .map(normalizeStoryGroup)
        .filter((group) => !!group.id && !group.deleted);
};

export const getStoryGroupById = async (id: string): Promise<StoryGroup | null> => {
    const response = await axiosInstance.get(`${STORY_GROUPS_ENDPOINT}/${encodeURIComponent(id)}`);
    const group = normalizeStoryGroup(extractSingleFromResponse(response.data));
    return group.id && !group.deleted ? group : null;
};

export const createStoryGroup = async (data: StoryGroupCreate): Promise<StoryGroup> => {
    const response = await axiosInstance.post(STORY_GROUPS_ENDPOINT, data);
    return normalizeStoryGroup(extractSingleFromResponse(response.data));
};

export const updateStoryGroup = async (id: string, data: StoryGroupUpdate): Promise<StoryGroup> => {
    const response = await axiosInstance.put(`${STORY_GROUPS_ENDPOINT}/${encodeURIComponent(id)}`, data);
    const group = normalizeStoryGroup(extractSingleFromResponse(response.data));
    return group.id ? group : { ...group, _id: id, id };
};

export const deleteStoryGroup = async (id: string): Promise<unknown> => {
    const response = await axiosInstance.delete(`${STORY_GROUPS_ENDPOINT}/${encodeURIComponent(id)}`);
    return response.data;
};

export const reorderStoryGroups = async (orderedIds: string[]): Promise<{ success: true; orderedIds: string[] }> => {
    await axiosInstance.patch(
        `${STORY_GROUPS_ENDPOINT}/reorder`,
        { items: orderedIds.map((id, index) => ({ id, order: index })) },
        { headers: { "x-silent": "1" } },
    );
    return { success: true, orderedIds };
};
