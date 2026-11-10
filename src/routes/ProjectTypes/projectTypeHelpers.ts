import type { ProjectType } from "@/api/requests/typesService";

export const getTypeNameEn = (type: ProjectType): string => {
    const name = type.name;
    if (!name) return "";
    return typeof name === "string" ? name : name.en || "";
};

export const getTypeNameAr = (type: ProjectType): string => {
    const name = type.name;
    if (!name) return "";
    return typeof name === "string" ? "" : name.ar || "";
};

export const getTypeKey = (type: ProjectType): string => type._id || type.id || getTypeNameEn(type);
