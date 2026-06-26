import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from './models/user.model';
import { ProjectModel } from './models/project.model';
import { ExperienceModel } from './models/experience.model';
import { SkillModel } from './models/skill.model';
import { BlogPostModel } from './models/blogPost.model';
import { CommentModel } from './models/comment.model';
import { CertificationModel } from './models/certification.model';
import { TestimonialModel } from './models/testimonial.model';
import { PortfolioModel } from './models/portfolio.model';
import { SubscriptionModel, createDefaultSubscription } from './models/subscription.model';
import { connectDB } from './config/db';

/**
 * Generate a URL-safe username from a display name.
 */
function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 30);
}

const seed = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log('Clearing existing data...');
    await UserModel.deleteMany({});
    await ProjectModel.deleteMany({});
    await ExperienceModel.deleteMany({});
    await SkillModel.deleteMany({});
    await BlogPostModel.deleteMany({});
    await CommentModel.deleteMany({});
    await CertificationModel.deleteMany({});
    await TestimonialModel.deleteMany({});
    await PortfolioModel.deleteMany({});
    await SubscriptionModel.deleteMany({});

    console.log('Seeding default superadmin and users...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    
    const owner = new UserModel({
      username: 'pratik-satish-date',
      name: 'Pratik Satish Date',
      email: 'pratikdate.sknsits.it@gmail.com',
      passwordHash,
      role: 'superadmin',
      authProvider: 'local',
      isVerified: true,
      subscriptionTier: 'premium',
      bio: 'IT Engineering student with hands-on experience in full-stack development, AI/ML, and cloud technologies.',
      githubUsername: 'PratikDate01',
      socialLinks: {
        github: 'https://github.com/PratikDate01',
        linkedin: 'https://www.linkedin.com/in/pratik-date-91999a32a/',
        twitter: 'https://x.com/PratikDate01',
      },
    });
    await owner.save();
    console.log('Superadmin seeded: pratikdate.sknsits.it@gmail.com / password123');

    // Create portfolio for owner
    const ownerPortfolio = new PortfolioModel({
      ownerId: owner._id,
      username: owner.username,
      slug: owner.username,
      headline: 'Full Stack Developer & AI/ML Enthusiast',
      bio: owner.bio,
      githubUsername: 'PratikDate01',
      socialLinks: owner.socialLinks,
      theme: 'corporate',
      visibility: 'public',
      seoSettings: {
        title: 'Pratik Date — Full Stack Developer Portfolio',
        description: 'Portfolio of Pratik Date — Full Stack Developer specializing in React, Node.js, and AI/ML.',
      },
      analyticsSettings: { enabled: true },
    });
    await ownerPortfolio.save();
    console.log('Owner portfolio created.');

    // Create subscription for owner
    const ownerSubscription = createDefaultSubscription(owner._id);
    ownerSubscription.tier = 'premium';
    await ownerSubscription.save();
    console.log('Owner subscription created (premium tier).');

    const regularUser = new UserModel({
      username: 'jane-doe',
      name: 'Jane Doe',
      email: 'jane@example.com',
      passwordHash,
      role: 'user',
      authProvider: 'local',
      isVerified: true,
      subscriptionTier: 'free',
      bio: 'Developer and tech enthusiast.',
    });
    await regularUser.save();
    console.log('Regular user seeded: jane@example.com / password123');

    // Create portfolio for regular user
    const janePortfolio = new PortfolioModel({
      ownerId: regularUser._id,
      username: regularUser.username,
      slug: regularUser.username,
      headline: 'Developer & Tech Enthusiast',
      bio: regularUser.bio,
      theme: 'nordic-frost',
      visibility: 'public',
      analyticsSettings: { enabled: true },
    });
    await janePortfolio.save();
    console.log('Jane portfolio created.');

    // Create subscription for regular user
    const janeSubscription = createDefaultSubscription(regularUser._id);
    await janeSubscription.save();
    console.log('Jane subscription created (free tier).');

    console.log('Seeding projects (owned by superadmin)...');
    const p1 = await ProjectModel.create({
      ownerId: owner._id,
      slug: 'speakwrite',
      title: 'SpeakWrite',
      summary: 'A full-stack web application designed for text-to-speech conversion with custom options.',
      description: 'SpeakWrite is a clean, simple utility to convert text into speech. Built with modern web technologies, it features an interactive interface with options to customize speed, pitch, and voice, making digital content more accessible.',
      coverImageUrl: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&w=800&q=80',
      techStack: ['HTML', 'CSS', 'JavaScript', 'React.js'],
      category: 'Frontend Web',
      tags: ['Accessibility', 'Web Speech API', 'Audio'],
      links: {
        github: 'https://github.com/PratikDate01/SpeakWrite',
        liveDemo: 'https://speakwrite.netlify.app/',
      },
      status: 'published',
      featured: true,
      order: 1,
      viewCount: 154,
    });

    const p2 = await ProjectModel.create({
      ownerId: owner._id,
      slug: 'mind-map-generator',
      title: 'Mind Map Generator',
      summary: 'An interactive visual tool that allows users to dynamically generate, edit, and visualize mind maps.',
      description: 'Mind Map Generator provides a visual canvas for mapping out thoughts, brainstorming ideas, and structuring information. Users can create nodes, establish relationships, and design interactive diagrams dynamically.',
      coverImageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80',
      techStack: ['HTML', 'CSS', 'JavaScript', 'React.js'],
      category: 'Frontend Web',
      tags: ['Visualization', 'SVG', 'Interactive Canvas'],
      links: {
        github: 'https://github.com/PratikDate01/Mind-Map-Generator',
        liveDemo: 'https://pratikdate.netlify.app/',
      },
      status: 'published',
      featured: true,
      order: 2,
      viewCount: 210,
    });

    const p3 = await ProjectModel.create({
      ownerId: owner._id,
      slug: 'ai-code-reviewer',
      title: 'AI Code Reviewer System',
      summary: 'An AI-powered system designed to analyze and review code quality with intelligent suggestions.',
      description: 'AI Code Reviewer automates pull request code diagnostics. By analyzing syntax structures, it detects performance regressions, typical bugs, and security weaknesses, suggesting exact code corrections for developers.',
      coverImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      techStack: ['Node.js', 'Express.js', 'React.js', 'Gemini API'],
      category: 'Artificial Intelligence',
      tags: ['LLM', 'Static Analysis', 'GitHub Integration'],
      links: {
        github: 'https://github.com/PratikDate01/ai-code-reviewer',
      },
      status: 'published',
      featured: true,
      order: 3,
      viewCount: 310,
    });
    console.log('Projects seeded!');

    console.log('Seeding experiences (owned by superadmin)...');
    await ExperienceModel.create({
      ownerId: owner._id,
      organization: 'Labmentix',
      role: 'Web Development Intern',
      type: 'internship',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-10-01'),
      description: 'Developed responsive web applications using React.js and Node.js backend services. Implemented REST APIs and optimized database queries, collaborating on system integrations.',
      responsibilities: [
        'Developed responsive web applications using React.js and Node.js backend services.',
        'Implemented REST APIs and optimized database queries improving performance.',
        'Collaborated on frontend-backend integration and version control using Git.',
      ],
      technologiesUsed: ['React.js', 'Node.js', 'Express.js', 'JavaScript', 'MongoDB', 'Git'],
      order: 1,
    });

    await ExperienceModel.create({
      ownerId: owner._id,
      organization: 'AICTE Edunet Foundation',
      role: 'AI & Machine Learning Intern',
      type: 'internship',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
      description: 'Worked on machine learning models and NLP techniques on real-world datasets for predictive analysis and intelligent solution generation.',
      responsibilities: [
        'Worked on machine learning models and real-world datasets for predictive analysis.',
        'Applied NLP techniques for text processing and intelligent solutions.',
      ],
      technologiesUsed: ['Python', 'Machine Learning', 'NLP', 'Data Science'],
      order: 2,
    });
    console.log('Experiences seeded!');

    console.log('Seeding skills (owned by superadmin)...');
    const skillsList = [
      { name: 'Java', category: 'backend', proficiency: 85, yearsExperience: 2 },
      { name: 'JavaScript', category: 'frontend', proficiency: 90, yearsExperience: 3 },
      { name: 'Python', category: 'backend', proficiency: 80, yearsExperience: 2 },
      { name: 'HTML & CSS', category: 'frontend', proficiency: 95, yearsExperience: 4 },
      { name: 'React.js', category: 'frontend', proficiency: 88, yearsExperience: 2 },
      { name: 'Node.js & Express.js', category: 'backend', proficiency: 85, yearsExperience: 2 },
      { name: 'MySQL', category: 'database', proficiency: 85, yearsExperience: 2 },
      { name: 'MongoDB', category: 'database', proficiency: 80, yearsExperience: 2 },
      { name: 'Git & GitHub', category: 'other', proficiency: 90, yearsExperience: 3 },
      { name: 'AWS (Basics)', category: 'other', proficiency: 75, yearsExperience: 1 },
      { name: 'Postman', category: 'other', proficiency: 85, yearsExperience: 2 }
    ];

    for (const s of skillsList) {
      await SkillModel.create({ ...s, ownerId: owner._id });
    }
    console.log('Skills seeded!');

    console.log('Seeding blog posts and comments...');
    const blog1 = await BlogPostModel.create({
      ownerId: owner._id,
      slug: 'mastering-monorepos-with-npm-workspaces',
      title: 'Mastering Monorepos with NPM Workspaces',
      excerpt: 'Learn how to structure and coordinate a full-stack typescript project using workspaces and shared type definition trees.',
      contentMarkdown: `## Structural Overview

Modern applications often benefit from unifying the client, api, and shared definitions into a single repository. NPM Workspaces makes managing dependencies clean and fast without complex external tooling.

### Why Workspace Packages?

1. **Shared Types**: Make changes in \`@portfolio-os/types\` and see compile feedback in real-time in both \`frontend\` and \`backend\`.
2. **Simplified Node Modules**: One root \`package-lock.json\` resolves all project trees.

\`\`\`json
{
  "workspaces": [
    "frontend",
    "backend",
    "types"
  ]
}
\`\`\`

Using this structure ensures consistent dependencies across all environments.`,
      coverImageUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd07871?auto=format&fit=crop&w=800&q=80',
      authorId: owner._id,
      categories: ['Development', 'TypeScript'],
      tags: ['Workspaces', 'Monorepo', 'NPM'],
      status: 'published',
      readingTimeMinutes: 3,
      viewCount: 188,
      likeCount: 42,
      publishedAt: new Date(),
    });

    const blog2 = await BlogPostModel.create({
      ownerId: owner._id,
      slug: 'rise-of-agentic-ai-coding-assistants',
      title: 'The Rise of Agentic AI Coding Assistants',
      excerpt: 'Exploring autonomous developer paradigms, agent workflows, and the future of pair programming.',
      contentMarkdown: `## Moving Beyond Autocomplete

We are witnessing a shift from static code autocomplete tools towards autonomous, goal-driven agents. Rather than just suggesting the next line of code, agentic systems analyze requirements, formulate plans, write tests, and run validation loops.

### Key Characteristics of Agent Workflows:
- **Planning Mode**: Design, iterate, and verify before modifying production components.
- **Tool Access**: Running build checks, inspecting directories, querying search databases.
- **Closed-Loop Verification**: Re-running tests automatically to check for lint issues.

This paradigm allows developers to focus on higher-level architecture and system design rather than boilerplate implementation details.`,
      coverImageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
      authorId: owner._id,
      categories: ['AI', 'Future of Work'],
      tags: ['LLM', 'AI Coding', 'Agentic Systems'],
      status: 'published',
      readingTimeMinutes: 4,
      viewCount: 250,
      likeCount: 89,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const blog3 = await BlogPostModel.create({
      ownerId: owner._id,
      slug: 'sleek-dark-mode-aesthetics',
      title: 'Sleek Dark Mode Aesthetics in Modern CSS',
      excerpt: 'A deep dive into styling high-contrast dark workspaces with glassmorphic cards and glowing accents.',
      contentMarkdown: `## High-Contrast Glow Aesthetics

To make user interfaces feel premium, color palettes must be tailored carefully. Avoid using pure black (\`#000000\`) or pure white (\`#ffffff\`). Instead, curate harmonious HSL color spaces.

### Glassmorphism System
Use dark semi-transparent backdrops coupled with backdrop filters to create depth:

\`\`\`css
.glass-card {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
\`\`\``,
      coverImageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
      authorId: owner._id,
      categories: ['Design', 'CSS'],
      tags: ['Glassmorphism', 'Aesthetics', 'UI-Design'],
      status: 'draft',
      readingTimeMinutes: 2,
      viewCount: 0,
      likeCount: 0,
    });

    // Add comments
    const comment1 = await CommentModel.create({
      postId: blog1._id,
      authorId: regularUser._id,
      body: 'This monorepo breakdown is super helpful! How do you handle environment-specific configurations in workspaces?',
      status: 'visible'
    });

    await CommentModel.create({
      postId: blog1._id,
      authorId: owner._id,
      parentCommentId: comment1._id,
      body: 'Thanks Jane! I typically keep dotenv files in each workspace folder and load them individually, or use a shared tool config at the root.',
      status: 'visible'
    });

    console.log('Blog posts and comments seeded!');

    console.log('Seeding certifications (owned by superadmin)...');
    await CertificationModel.create({
      ownerId: owner._id,
      title: 'AWS Certified Solutions Architect Job Simulation',
      issuer: 'Amazon Web Services (AWS) / Forage',
      issueDate: new Date('2025-01-15'),
      credentialUrl: 'https://www.theforage.com/',
      imageUrl: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=800&q=80',
      skills: ['AWS', 'Cloud Architecture', 'S3', 'EC2', 'IAM'],
      category: 'cloud'
    });

    await CertificationModel.create({
      ownerId: owner._id,
      title: 'Accenture Software Engineering Job Simulation',
      issuer: 'Accenture / Forage',
      issueDate: new Date('2025-02-10'),
      credentialUrl: 'https://www.theforage.com/',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
      skills: ['Software Engineering', 'Agile Methodologies', 'System Architecture'],
      category: 'development'
    });

    await CertificationModel.create({
      ownerId: owner._id,
      title: 'TATA GenAI Powered Data Analytics Job Simulation',
      issuer: 'TATA Group / Forage',
      issueDate: new Date('2025-03-20'),
      credentialUrl: 'https://www.theforage.com/',
      imageUrl: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=800&q=80',
      skills: ['Generative AI', 'Data Analytics', 'Python', 'Data Visualization'],
      category: 'ai'
    });

    await CertificationModel.create({
      ownerId: owner._id,
      title: 'Microsoft C# Certification',
      issuer: 'Microsoft',
      issueDate: new Date('2024-10-05'),
      credentialUrl: 'https://learn.microsoft.com/',
      imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
      skills: ['C#', '.NET', 'OOP', 'Programming'],
      category: 'development'
    });

    await CertificationModel.create({
      ownerId: owner._id,
      title: 'IBM Web Development & Programming Certifications',
      issuer: 'IBM',
      issueDate: new Date('2024-08-12'),
      credentialUrl: 'https://www.credly.com/',
      imageUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd07871?auto=format&fit=crop&w=800&q=80',
      skills: ['HTML', 'CSS', 'JavaScript', 'Java'],
      category: 'development'
    });
    console.log('Certifications seeded!');

    console.log('Seeding testimonials (for superadmin portfolio)...');
    await TestimonialModel.create({
      portfolioOwnerId: owner._id,
      authorName: 'Sarah Jenkins',
      authorRole: 'VP of Product',
      authorCompany: 'OrbitTech Corp',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      rating: 5,
      body: 'Pratik is an exceptional engineer who transformed our development pipeline. His knowledge of monorepos, isolated builds, and typed schemas saved our team dozens of hours.',
      status: 'approved',
      relatedProjectId: p1._id
    });

    await TestimonialModel.create({
      portfolioOwnerId: owner._id,
      authorName: 'David Chen',
      authorRole: 'CTO',
      authorCompany: 'SaaSify Inc',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      rating: 5,
      body: 'Outstanding attention to detail and design. The real-time interactive canvas he built works flawlessly, and he was very helpful with training our staff.',
      status: 'approved',
      relatedProjectId: p3._id
    });

    await TestimonialModel.create({
      portfolioOwnerId: owner._id,
      authorName: 'Alex Mercer',
      authorRole: 'Founder',
      authorCompany: 'NextGen AI',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
      rating: 4,
      body: 'Pratik contributed core components to our AI review pipeline. His prompt optimizations and automated mock validation systems were exactly what we needed.',
      status: 'pending',
      relatedProjectId: p2._id
    });
    console.log('Testimonials seeded!');

    console.log('Database Seeding Completed Successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
