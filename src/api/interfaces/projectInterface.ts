export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId?: string;
  parentProject?: string;
  rootOnly?: boolean;
  published?: boolean;
  order?: number;
  type?: string;
  category?: string;
  tag?: string;
  location?: string;
  subProjects?: Project[];
  client?: any;
  // Optional arrays used throughout the UI
  categories?: string[];
  tags?: string[];
  types?: string[];
  // Media/materials associated with the project
  material?: Material[];
  // Cast / team members
  cast?: CastMember[];
  // Main cover/hero media
  mainCover?: CoverMedia;
  // Soft-delete flag
  deleted?: boolean;
  // Mongoose version key (if present)
  __v?: number;
  // Creator info
  createdBy?: { fullName?: string; name?: string; _id?: string } | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Material {
  _id?: string;
  id?: string;
  type?: 'photo' | 'video' | 'before_after' | 'text' | 'html' | string;
  url?: string;
  thumbnail?: string;
  caption?: string;
  items?: MaterialPhotoItem[];
  textContent?: string;
  htmlContent?: string;
  before?: { url?: string; label?: string; type?: string };
  after?: { url?: string; label?: string; type?: string };
  mimeType?: string;
  size?: number;
  originalName?: string;
  order?: number;
  label?: string;
}

export interface MaterialPhotoItem {
  url?: string;
  mimeType?: string;
  originalName?: string;
  size?: number;
  type?: 'photo';
}

export interface CastMember {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  order?: number;
  socialLinks?: { platform: string; url: string }[];
  photo?: any;
  [key: string]: any;
}

export interface CoverMedia {
  url?: string;
  mimeType?: string;
  originalName?: string;
  size?: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  clientId?: string;
  parentProject?: string;
  type?: string;
  category?: string;
  tag?: string;
  location?: string;
}

export interface ProjectUpdate extends Partial<ProjectCreate> {}
