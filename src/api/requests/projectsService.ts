import axiosInstance from "../axios";
import type { Project, ProjectCreate, ProjectUpdate } from "../interfaces/projectInterface";

const PROJECTS_ENDPOINT = "/projects";

export interface ProjectTaxonomyOption {
  _id?: string;
  id?: string;
  name: string | { en?: string; ar?: string };
  title?: string[];
  socialLinks?: { platform: string; url: string; _id?: string }[];
  photo?: any;
}

const extractArrayFromResponse = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.categories)) return payload.categories;
  if (Array.isArray(payload?.types)) return payload.types;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.cast)) return payload.cast;
  if (Array.isArray(payload?.companies)) return payload.companies;
  if (Array.isArray(payload?.data?.categories)) return payload.data.categories;
  if (Array.isArray(payload?.data?.types)) return payload.data.types;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.cast)) return payload.data.cast;
  return [];
};

const normalizeTaxonomyOption = (item: any): ProjectTaxonomyOption | null => {
  if (typeof item === "string") {
    const name = item.trim();
    if (!name) return null;
    return { name };
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const id = String(item._id || item.id || "").trim();
  const rawName = item.name || item.title || item.label || item.value || id || "";
  let name: string | { en?: string; ar?: string };
  if (rawName && typeof rawName === "object") {
    const en = String(rawName.en || "").trim();
    const ar = String(rawName.ar || "").trim();
    if (en || ar) {
      name = { en, ar };
    } else {
      name = "";
    }
  } else {
    name = String(rawName || "").trim();
  }
  if (typeof name === "string" && !name) return null;
  if (typeof name === "object" && !name.en && !name.ar) return null;

  return {
    _id: id || undefined,
    id: id || undefined,
    name,
    ...(() => {
      const raw = item.titles || item.title;
      if (!raw) return {};
      const arr = Array.isArray(raw)
        ? raw.flatMap((v: any) => typeof v === "string" ? v.split(",").map((s: string) => s.trim()).filter(Boolean) : [String(v)])
        : String(raw).split(",").map((s: string) => s.trim()).filter(Boolean);
      return arr.length ? { title: arr } : {};
    })(),
    ...(Array.isArray(item.socialLinks) && item.socialLinks.length
      ? { socialLinks: item.socialLinks.filter((l: any) => l && l.url).map((l: any) => ({ platform: l.platform || "", url: l.url, _id: l._id })) }
      : {}),
    ...(item.photo ? { photo: item.photo } : {}),
  };
};

const uniqueTaxonomyOptions = (items: ProjectTaxonomyOption[]): ProjectTaxonomyOption[] => {
  const seen = new Set<string>();
  const unique: ProjectTaxonomyOption[] = [];

  items.forEach((item) => {
    const key = (item._id || item.id || (typeof item.name === 'string' ? item.name : item.name?.en || item.name?.ar || '')).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique;
};

const localizedText = (value: any): any => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("ar" in value || "en" in value) {
      return value.en || value.ar || "";
    }
  }
  return value;
};

const transformProject = (raw: any): Project => {
  if (!raw) return raw;
  // Preserve normalized fields while keeping the full raw payload available
  const base: any = {
    ...raw,
    id: raw._id || raw.id || "",
    name: localizedText(raw.name) || raw.title || "",
    description: localizedText(raw.description) || "",
    clientId: raw.client?._id || raw.clientId || raw.client || undefined,
    parentProject: raw.parentProject || undefined,
    rootOnly: raw.rootOnly || false,
    published: raw.published || false,
    type: raw.type || "",
    category: raw.category || "",
    tag: raw.tag || "",
    location: localizedText(raw.location) || "",
    client: raw.client || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    // Keep the raw localized objects so editors can round-trip ar/en values
    localizedName: raw.name,
    localizedDescription: raw.description,
    localizedLocation: raw.location,
  };

  // Ensure subProjects are transformed recursively
  if (Array.isArray(raw.subProjects)) {
    base.subProjects = raw.subProjects.map(transformProject);
  } else {
    base.subProjects = [];
  }

  return base;
};

export const getProjects = async (params?: Record<string, any>): Promise<Project[]> => {
  try {
    const mergedParams = { ...(params || {}), PageCount: "all" };
    const response = await axiosInstance.get(PROJECTS_ENDPOINT, { params: mergedParams });
    const responseData = response.data;
    let data: any[] = [];
    if (Array.isArray(responseData)) data = responseData;
    else if (Array.isArray(responseData?.projects)) data = responseData.projects;
    else if (Array.isArray(responseData?.data)) data = responseData.data;
    else if (Array.isArray(responseData?.data?.projects)) data = responseData.data.projects;
    else data = [];

    return data.map(transformProject).filter(Boolean);
  } catch (error) {
    throw error;
  }
};

export const createProject = async (data: ProjectCreate): Promise<Project> => {
  try {
    const response = await axiosInstance.post(PROJECTS_ENDPOINT, data);
    const raw = response.data?.project || response.data?.data?.project || response.data?.data || response.data;
    return transformProject(raw);
  } catch (error) {
    throw error;
  }
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  try {
    const response = await axiosInstance.get(`${PROJECTS_ENDPOINT}/${id}`, { params: { PageCount: "all" } });
    const raw = response.data?.project || response.data?.data || response.data;
    return transformProject(raw);
  } catch (error) {
    throw error;
  }
};

export const updateProject = async (id: string, data: ProjectUpdate): Promise<Project> => {
  try {
    const response = await axiosInstance.put(`${PROJECTS_ENDPOINT}/${id}`, data);
    const raw = response.data?.data || response.data;
    return transformProject(raw);
  } catch (error) {
    throw error;
  }
};

export const togglePublishProject = async (id: string): Promise<Project> => {
  try {
    const response = await axiosInstance.patch(`${PROJECTS_ENDPOINT}/${id}/publish`);
    const raw = response.data?.data || response.data;
    return transformProject(raw);
  } catch (error) {
    throw error;
  }
};

export const deleteProject = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`${PROJECTS_ENDPOINT}/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const reorderProjects = async (orderedIds: string[]): Promise<any> => {
  await axiosInstance.patch(
    `${PROJECTS_ENDPOINT}/reorder`,
    { items: orderedIds.map((id, i) => ({ id, order: i })) },
    { headers: { "x-silent": "1" } },
  );
  return { success: true, orderedIds };
};



export const getProjectCategories = async (): Promise<ProjectTaxonomyOption[]> => {
  try {
    const response = await axiosInstance.get("/categories", {
      params: { type: "project", page: 1, limit: 200 },
    });
    const raw = extractArrayFromResponse(response.data);
    const normalized = raw
      .map(normalizeTaxonomyOption)
      .filter((item): item is ProjectTaxonomyOption => !!item);
    return uniqueTaxonomyOptions(normalized);
  } catch (error) {
    throw error;
  }
};

export const getProjectTypes = async (): Promise<ProjectTaxonomyOption[]> => {
  try {
    const response = await axiosInstance.get("/types", {
      params: { PageCount: "all" },
    });
    const raw = extractArrayFromResponse(response.data);
    const normalized = raw
      .map(normalizeTaxonomyOption)
      .filter((item): item is ProjectTaxonomyOption => !!item);
    return uniqueTaxonomyOptions(normalized);
  } catch (error) {
    throw error;
  }
};


export const getProjectCast = async (): Promise<ProjectTaxonomyOption[]> => {
  const normalize = (raw: any[]) =>
    uniqueTaxonomyOptions(
      raw.map(normalizeTaxonomyOption).filter((item): item is ProjectTaxonomyOption => !!item),
    );

  try {
    const response = await axiosInstance.get("/cast", {
      params: { PageCount: "all" },
    });
    return normalize(extractArrayFromResponse(response.data));
  } catch {
    const fallbackResponse = await axiosInstance.get(`${PROJECTS_ENDPOINT}/cast`, {
      params: { PageCount: "all" },
    });
    return normalize(extractArrayFromResponse(fallbackResponse.data));
  }
};


