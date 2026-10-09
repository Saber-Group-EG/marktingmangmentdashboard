import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjects, projectsKeys } from "./useProjectsQuery";
import { getProjectsCastRefs, type ProjectCastRef } from "@/api/requests/projectsService";

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

export const useCastProjectCounts = (castMembers?: { _id?: string; id?: string; name?: string }[]) => {
    const { data: projectCastRefs = [], isLoading } = useQuery<ProjectCastRef[]>({
        queryKey: [...projectsKeys.lists(), "cast-refs"],
        queryFn: getProjectsCastRefs,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    const { castCounts, totalProjects } = useMemo(() => {
        const nameToId: Record<string, string> = {};
        for (const member of castMembers || []) {
            const id = extractId(member);
            const name = (member?.name || "").trim().toLowerCase();
            if (id && name && !(name in nameToId)) nameToId[name] = id;
        }

        const counts: Record<string, number> = {};
        for (const project of projectCastRefs) {
            const ids = new Set<string>();
            for (const member of project.cast) {
                const id =
                    extractId(typeof member === "string" ? member : (member as any)?.castId) ||
                    extractId((member as any)?._id) ||
                    extractId((member as any)?.id) ||
                    nameToId[String((member as any)?.name || "").trim().toLowerCase()];
                if (id) ids.add(id);
            }
            for (const id of ids) counts[id] = (counts[id] || 0) + 1;
        }

        return { castCounts: counts, totalProjects: projectCastRefs.length };
    }, [projectCastRefs, castMembers]);

    return { castCounts, totalProjects, isLoading };
};
