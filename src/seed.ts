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
      username: 'pratik-date',
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
      theme: 'portfolio-os',
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
      theme: 'portfolio-os',
      visibility: 'public',
      analyticsSettings: { enabled: true },
    });
    await janePortfolio.save();
    console.log('Jane portfolio created.');

    // Create subscription for regular user
    const janeSubscription = createDefaultSubscription(regularUser._id);
    await janeSubscription.save();
    console.log('Jane subscription created (free tier).');

    console.log('Skipping seeding of mock projects, experiences, skills, blogs, certifications, and testimonials to keep database clean.');

    console.log('Database Seeding Completed Successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
