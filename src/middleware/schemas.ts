import { z } from 'zod';

export const cloudinaryAssetSchema = z.object({
  publicId: z.string(),
  secureUrl: z.string().url(),
  resourceType: z.enum(['image', 'video', 'raw']),
  format: z.string(),
  bytes: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  uploadedAt: z.string().or(z.date()).optional(),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const projectSchema = z.object({
  body: z.object({
    slug: z.string().optional().or(z.literal('')),
    title: z.string().min(1, 'Title is required'),
    summary: z.string().min(1, 'Summary is required'),
    description: z.string().min(1, 'Description is required'),
    coverImageUrl: z.string().url('Cover image must be a valid URL').optional().or(z.literal('')),
    thumbnail: cloudinaryAssetSchema.optional(),
    category: z.string().min(1, 'Category is required'),
    techStack: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    links: z.object({
      github: z.string().url('GitHub link must be a valid URL').optional().or(z.literal('')),
      liveDemo: z.string().url('Live demo link must be a valid URL').optional().or(z.literal('')),
      docs: z.string().url('Docs link must be a valid URL').optional().or(z.literal('')),
    }).optional(),
    gallery: z.array(
      z.object({
        url: z.string().url('Gallery item must be a valid URL'),
        type: z.enum(['image', 'video']),
        caption: z.string().optional(),
        publicId: z.string().optional(),
        secureUrl: z.string().url().optional(),
        resourceType: z.enum(['image', 'video', 'raw']).optional(),
        format: z.string().optional(),
        bytes: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        uploadedAt: z.string().or(z.date()).optional(),
      })
    ).default([]),
    demoVideo: cloudinaryAssetSchema.optional(),
    architectureDiagram: cloudinaryAssetSchema.optional(),
    caseStudy: z.object({
      problem: z.string().optional().or(z.literal('')),
      research: z.string().optional().or(z.literal('')),
      architecture: z.string().optional().or(z.literal('')),
      challenges: z.string().optional().or(z.literal('')),
      solutions: z.string().optional().or(z.literal('')),
      results: z.string().optional().or(z.literal('')),
      lessonsLearned: z.string().optional().or(z.literal('')),
      metrics: z.array(
        z.object({
          label: z.string().min(1, 'Metric label is required'),
          value: z.string().min(1, 'Metric value is required'),
        })
      ).default([]),
    }).optional(),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    featured: z.boolean().default(false),
    order: z.number().int().default(0),
  }),
});

export const experienceSchema = z.object({
  body: z.object({
    organization: z.string().min(1, 'Organization is required'),
    role: z.string().min(1, 'Role is required'),
    type: z.enum(['job', 'internship', 'education', 'achievement']),
    startDate: z.string().transform((val) => new Date(val)),
    endDate: z.string().transform((val) => new Date(val)).optional().nullable(),
    description: z.string().min(1, 'Description is required'),
    responsibilities: z.array(z.string()).default([]),
    technologiesUsed: z.array(z.string()).default([]),
    order: z.number().int().default(0),
  }),
});

export const skillSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Skill name is required'),
    category: z.enum(['frontend', 'backend', 'database', 'devops', 'cloud', 'ai', 'other']),
    proficiency: z.number().min(1).max(100),
    yearsExperience: z.number().min(0).default(0),
    iconUrl: z.string().optional(),
  }),
});

export const messageSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    subject: z.string().optional(),
    body: z.string().min(1, 'Message body is required'),
    source: z.enum(['contact_form', 'whatsapp_click', 'calendar_booking']).default('contact_form'),
    attachmentUrl: z.string().optional(),
    attachment: cloudinaryAssetSchema.optional(),
  }),
});

export const blogPostSchema = z.object({
  body: z.object({
    slug: z.string().optional().or(z.literal('')),
    title: z.string().min(1, 'Title is required'),
    excerpt: z.string().min(1, 'Excerpt is required'),
    contentMarkdown: z.string().min(1, 'Markdown content is required'),
    coverImageUrl: z.string().url('Cover image must be a valid URL').optional().or(z.literal('')),
    coverImage: cloudinaryAssetSchema.optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  }),
});

export const commentSchema = z.object({
  body: z.object({
    body: z.string().min(1, 'Comment text is required'),
    parentCommentId: z.string().optional(),
  }),
});

export const certificationSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    issuer: z.string().min(1, 'Issuer is required'),
    issueDate: z.string().transform((val) => new Date(val)),
    expiryDate: z.string().transform((val) => new Date(val)).optional().nullable(),
    credentialUrl: z.string().url('Credential verification link must be a valid URL').optional().or(z.literal('')),
    imageUrl: z.string().url('Certificate image must be a valid URL').optional().or(z.literal('')),
    certificateImage: cloudinaryAssetSchema.optional(),
    certificatePdf: cloudinaryAssetSchema.optional(),
    skills: z.array(z.string()).default([]),
    category: z.string().min(1, 'Category is required'),
  }),
});

export const testimonialSchema = z.object({
  body: z.object({
    authorName: z.string().min(1, 'Author name is required'),
    authorRole: z.string().min(1, 'Author role is required'),
    authorCompany: z.string().optional(),
    authorAvatarUrl: z.string().url().optional().or(z.literal('')),
    rating: z.number().min(1).max(5),
    body: z.string().min(1, 'Testimonial text is required'),
    videoUrl: z.string().url().optional().or(z.literal('')),
    relatedProjectId: z.string().optional(),
  }),
});

export const testimonialStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
  }),
});

export const resumeSchema = z.object({
  body: z.object({
    label: z.string().min(1, 'Label is required'),
    resumeFile: cloudinaryAssetSchema,
    isActive: z.boolean().default(false),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});


