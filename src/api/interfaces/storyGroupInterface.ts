export interface StoryLocalizedText {
    ar?: string;
    en?: string;
}

export interface StoryMaterial {
    type: "photo" | "video";
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    thumbnail?: string;
    caption?: StoryLocalizedText;
    order?: number;
}

export interface StoryGroupCover {
    url?: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
}

export interface StoryGroup {
    _id?: string;
    id?: string;
    title: { ar: string; en: string };
    subtitle?: StoryLocalizedText;
    coverImage?: StoryGroupCover;
    material?: StoryMaterial[];
    order?: number;
    deleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export type StoryGroupCreate = {
    title: { ar: string; en: string };
    subtitle?: StoryLocalizedText;
    coverImage?: StoryGroupCover;
    material?: StoryMaterial[];
    order?: number;
};

export type StoryGroupUpdate = Partial<StoryGroupCreate>;

export const getStoryGroupId = (group: StoryGroup): string => group._id || group.id || "";
