import { useMemo } from "react";
import { useProjects } from "./useProjectsQuery";

const extractId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value || null;
    if (typeof value === "object") return value._id || value.id || null;
    return null;
};

const extractCategoryId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "object") return value._id || value.id || null;
    return null;
};

export const useProjectCounts = () => {
    const { data: projects = [], isLoading } = useProjects();

    const castCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const project of projects) {
            if (!Array.isArray(project.cast)) continue;
            for (const member of project.cast) {
                const id =
                    extractId((member as any).castId) ||
                    extractId(member._id) ||
                    extractId(member.id);
                if (id) counts[id] = (counts[id] || 0) + 1;
            }
        }
        return counts;
    }, [projects]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const project of projects) {
            const ids = new Set<string>();

            // project.category can be a string ID or populated object
            const catId = extractCategoryId(project.category);
            if (catId) ids.add(catId);

            // project.categories can be an array of strings or populated objects
            if (Array.isArray((project as any).categories)) {
                for (const cat of (project as any).categories) {
                    const id = extractCategoryId(cat);
                    if (id) ids.add(id);
                }
            }

            for (const id of ids) {
                counts[id] = (counts[id] || 0) + 1;
            }
        }
        return counts;
    }, [projects]);

    const totalProjects = projects.length;

    return { castCounts, categoryCounts, totalProjects, isLoading };
};
