export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video' | 'raw';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  uploadedAt: Date | string;
}

// ─── SaaS Role System ──────────────────────────────────────────────────
export type SaaSRole = 'superadmin' | 'admin' | 'user' | 'guest';

// ─── Subscription Tiers ─────────────────────────────────────────────────
export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise';

export type PortfolioTheme = 'developer' | 'minimal' | 'corporate' | 'creative' | 'portfolio-os';

// ─── User ───────────────────────────────────────────────────────────────
export interface User {
  _id?: string;
  username: string;
  name: string;
  email: string;
  passwordHash?: string;
  authProvider: 'local' | 'google' | 'github';
  providerId?: string;
  avatarUrl?: string;
  profileImage?: CloudinaryAsset;
  coverImage?: CloudinaryAsset;
  role: SaaSRole;
  bio?: string;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  githubUsername?: string;
  subscriptionTier: SubscriptionTier;
  badgeIds: string[];
  refreshTokenHash?: string;
  isVerified: boolean;
  lastLoginAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Portfolio ──────────────────────────────────────────────────────────
export interface Portfolio {
  _id?: string;
  ownerId: string;
  username: string;
  slug: string;
  headline?: string;
  bio?: string;
  profileImage?: CloudinaryAsset;
  coverImage?: CloudinaryAsset;
  githubUsername?: string;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  theme: PortfolioTheme;
  visibility: 'public' | 'private' | 'unlisted';
  customDomain?: string;
  seoSettings?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  analyticsSettings?: {
    enabled: boolean;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Subscription ───────────────────────────────────────────────────────
export interface SubscriptionLimits {
  maxProjects: number;
  maxStorageMB: number;
  maxThemes: number;
  aiUsagePerMonth: number;
  customDomain: boolean;
  analyticsAccess: 'basic' | 'full';
}

export interface Subscription {
  _id?: string;
  userId: string;
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  startsAt: Date | string;
  expiresAt?: Date | string;
  isActive: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Audit Log ──────────────────────────────────────────────────────────
export interface AuditLog {
  _id?: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt?: Date | string;
}

// ─── Project (tenant-scoped) ────────────────────────────────────────────
export interface ProjectGalleryItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
  publicId?: string;
  secureUrl?: string;
  resourceType?: 'image' | 'video' | 'raw';
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  uploadedAt?: Date | string;
}

export interface ProjectCaseStudy {
  problem: string;
  research: string;
  architecture: string;
  challenges: string;
  solutions: string;
  results: string;
  metrics: { label: string; value: string }[];
  lessonsLearned: string;
}

export interface Project {
  _id?: string;
  ownerId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  coverImageUrl: string;
  thumbnail?: CloudinaryAsset;
  gallery: ProjectGalleryItem[];
  demoVideo?: CloudinaryAsset;
  architectureDiagram?: CloudinaryAsset;
  techStack: string[];
  category: string;
  tags: string[];
  links: {
    github?: string;
    liveDemo?: string;
    docs?: string;
  };
  caseStudy?: ProjectCaseStudy;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  viewCount: number;
  order: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Blog Post (tenant-scoped) ──────────────────────────────────────────
export interface BlogPost {
  _id?: string;
  ownerId: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  coverImageUrl?: string;
  coverImage?: CloudinaryAsset;
  authorId: string;
  categories: string[];
  tags: string[];
  status: 'draft' | 'published';
  readingTimeMinutes: number;
  viewCount: number;
  likeCount: number;
  publishedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Comment ────────────────────────────────────────────────────────────
export interface Comment {
  _id?: string;
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string;
  status: 'visible' | 'flagged' | 'removed';
  createdAt?: Date | string;
}

// ─── Certification (tenant-scoped) ──────────────────────────────────────
export interface Certification {
  _id?: string;
  ownerId: string;
  title: string;
  issuer: string;
  issueDate: Date | string;
  expiryDate?: Date | string;
  credentialUrl?: string;
  imageUrl: string;
  certificateImage?: CloudinaryAsset;
  certificatePdf?: CloudinaryAsset;
  skills: string[];
  category: string;
  createdAt?: Date | string;
}

// ─── Testimonial (tenant-scoped) ────────────────────────────────────────
export interface Testimonial {
  _id?: string;
  portfolioOwnerId: string;
  authorName: string;
  authorRole: string;
  authorCompany?: string;
  authorAvatarUrl?: string;
  rating: number;
  body: string;
  videoUrl?: string;
  relatedProjectId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Date | string;
}

// ─── Experience (tenant-scoped) ─────────────────────────────────────────
export interface Experience {
  _id?: string;
  ownerId: string;
  organization: string;
  role: string;
  type: 'job' | 'internship' | 'education' | 'achievement';
  startDate: Date | string;
  endDate?: Date | string;
  description: string;
  responsibilities: string[];
  technologiesUsed: string[];
  order: number;
  createdAt?: Date | string;
}

// ─── Skill (tenant-scoped) ──────────────────────────────────────────────
export interface Skill {
  _id?: string;
  ownerId: string;
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'cloud' | 'ai' | 'other';
  proficiency: number;
  yearsExperience: number;
  relatedProjectIds: string[];
  iconUrl?: string;
}

// ─── Message (tenant-scoped) ────────────────────────────────────────────
export interface Message {
  _id?: string;
  portfolioOwnerId: string;
  name: string;
  email: string;
  subject?: string;
  body: string;
  attachmentUrl?: string;
  attachment?: CloudinaryAsset;
  status: 'unread' | 'read' | 'replied' | 'archived';
  source: 'contact_form' | 'whatsapp_click' | 'calendar_booking';
  createdAt?: Date | string;
}

// ─── Resume (tenant-scoped — already has userId) ────────────────────────
export interface Resume {
  _id?: string;
  label: string;
  userId: string;
  resumeFile: CloudinaryAsset;
  isActive: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ─── Upload Record (tenant-scoped) ──────────────────────────────────────
export interface UploadRecord {
  _id?: string;
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video' | 'raw';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  originalName: string;
  folder: string;
  ownerId: string;
  uploadedAt: Date | string;
}

// ─── Site Config (platform-level singleton) ─────────────────────────────
export interface SiteConfig {
  _id?: string;
  resumeVersions: { label: string; fileUrl: string }[];
  stats: {
    projectsCompleted: number;
    clients: number;
    internships: number;
    certifications: number;
  };
  maintenanceMode: boolean;
  updatedAt?: Date | string;
}

// ─── Badge ──────────────────────────────────────────────────────────────
export interface Badge {
  _id?: string;
  key: string;
  title: string;
  description: string;
  iconUrl: string;
  xpReward: number;
  criteria: string;
  createdAt?: Date | string;
}

// ─── User Progress Event ────────────────────────────────────────────────
export interface UserProgressEvent {
  _id?: string;
  userId: string;
  type: 'page_visit' | 'project_view' | 'badge_earned' | 'comment_posted' | 'message_sent';
  xpAwarded: number;
  metadata?: Record<string, any>;
  createdAt?: Date | string;
}

// ─── Bookmark ───────────────────────────────────────────────────────────
export interface Bookmark {
  _id?: string;
  userId: string;
  targetType: 'project' | 'blogpost';
  targetId: string;
  createdAt?: Date | string;
}

// ─── Analytics Event (tenant-scoped) ────────────────────────────────────
export interface AnalyticsEvent {
  _id?: string;
  portfolioOwnerId: string;
  sessionId: string;
  userId?: string;
  type: 'page_view' | 'download' | 'outbound_click' | 'project_view';
  path: string;
  referrer?: string;
  country?: string;
  device?: string;
  metadata?: Record<string, any>;
  createdAt?: Date | string;
}

// ─── Subscription Plan Defaults ─────────────────────────────────────────
export const SUBSCRIPTION_PLAN_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    maxProjects: 5,
    maxStorageMB: 100,
    maxThemes: 2,
    aiUsagePerMonth: 20,
    customDomain: false,
    analyticsAccess: 'basic',
  },
  pro: {
    maxProjects: 25,
    maxStorageMB: 1000,
    maxThemes: 5,
    aiUsagePerMonth: 100,
    customDomain: false,
    analyticsAccess: 'full',
  },
  premium: {
    maxProjects: 100,
    maxStorageMB: 5000,
    maxThemes: 5,
    aiUsagePerMonth: 500,
    customDomain: true,
    analyticsAccess: 'full',
  },
  enterprise: {
    maxProjects: Infinity,
    maxStorageMB: Infinity,
    maxThemes: 5,
    aiUsagePerMonth: Infinity,
    customDomain: true,
    analyticsAccess: 'full',
  },
};
