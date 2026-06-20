/**
 * Migration: Single-Tenant → Multi-Tenant
 * 
 * This script migrates the existing Portfolio OS database from a single-tenant
 * architecture to multi-tenant by:
 * 
 * 1. Adding `username` to existing users who don't have one
 * 2. Updating role enum values (owner→superadmin, member→user)
 * 3. Creating Portfolio documents for each user
 * 4. Setting `ownerId` on all orphaned content (Projects, Skills, Experience, etc.)
 * 5. Creating default Subscriptions for each user
 * 6. Logging every mutation for audit trail
 * 
 * Usage:
 *   npx ts-node-dev src/migrations/migrate-to-multitenant.ts
 *   npx ts-node-dev src/migrations/migrate-to-multitenant.ts --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { UserModel } from '../models/user.model';
import { ProjectModel } from '../models/project.model';
import { SkillModel } from '../models/skill.model';
import { ExperienceModel } from '../models/experience.model';
import { CertificationModel } from '../models/certification.model';
import { BlogPostModel } from '../models/blogPost.model';
import { MessageModel } from '../models/message.model';
import { TestimonialModel } from '../models/testimonial.model';
import { PortfolioModel } from '../models/portfolio.model';
import { SubscriptionModel, createDefaultSubscription } from '../models/subscription.model';
import { UploadRecordModel } from '../models/upload.model';
import { SUBSCRIPTION_PLAN_LIMITS } from '@portfolio-os/types';

const DRY_RUN = process.argv.includes('--dry-run');
const log: string[] = [];

function emit(message: string) {
  console.log(message);
  log.push(`[${new Date().toISOString()}] ${message}`);
}

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

/**
 * Ensure username uniqueness by appending a numeric suffix.
 */
async function ensureUniqueUsername(baseUsername: string, excludeUserId?: string): Promise<string> {
  let candidate = baseUsername;
  let suffix = 1;

  while (true) {
    const query: any = { username: candidate };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }
    const existing = await UserModel.findOne(query).lean();
    if (!existing) return candidate;
    candidate = `${baseUsername}-${suffix}`;
    suffix++;
    if (suffix > 100) throw new Error(`Cannot generate unique username from base: ${baseUsername}`);
  }
}

async function migrate() {
  try {
    await connectDB();
    emit(`\n${'='.repeat(60)}`);
    emit(`MIGRATION: Single-Tenant → Multi-Tenant`);
    emit(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be written)' : 'LIVE'}`);
    emit(`Started: ${new Date().toISOString()}`);
    emit(`${'='.repeat(60)}\n`);

    // ─── Step 1: Identify the primary owner ─────────────────────────────
    emit('Step 1: Identifying primary owner...');
    let primaryOwner = await UserModel.findOne({ role: { $in: ['owner', 'superadmin'] } }).sort({ createdAt: 1 });
    
    if (!primaryOwner) {
      emit('ERROR: No user with role "owner" or "superadmin" found. Cannot proceed.');
      process.exit(1);
    }
    emit(`  Primary owner: ${primaryOwner.name} (${primaryOwner.email}) [${primaryOwner._id}]`);

    // ─── Step 2: Add usernames to all users ─────────────────────────────
    emit('\nStep 2: Adding usernames to users...');
    const allUsers = await UserModel.find({});
    let usernamesAdded = 0;

    for (const user of allUsers) {
      if (!user.username) {
        const baseUsername = generateUsername(user.name);
        const uniqueUsername = await ensureUniqueUsername(baseUsername, user._id.toString());

        if (!DRY_RUN) {
          user.username = uniqueUsername;
          await user.save({ validateBeforeSave: false });
        }
        emit(`  [USERNAME] ${user.email} → ${uniqueUsername}`);
        usernamesAdded++;
      } else {
        emit(`  [SKIP] ${user.email} already has username: ${user.username}`);
      }
    }
    emit(`  Total usernames added: ${usernamesAdded}`);

    // ─── Step 3: Update role enum values ────────────────────────────────
    emit('\nStep 3: Updating role values...');
    if (!DRY_RUN) {
      const ownerResult = await UserModel.updateMany(
        { role: 'owner' as any },
        { $set: { role: 'superadmin' } }
      );
      emit(`  "owner" → "superadmin": ${ownerResult.modifiedCount} users updated`);

      const memberResult = await UserModel.updateMany(
        { role: 'member' as any },
        { $set: { role: 'user' } }
      );
      emit(`  "member" → "user": ${memberResult.modifiedCount} users updated`);
    } else {
      const ownerCount = await UserModel.countDocuments({ role: 'owner' as any });
      const memberCount = await UserModel.countDocuments({ role: 'member' as any });
      emit(`  [DRY RUN] Would update ${ownerCount} "owner" → "superadmin"`);
      emit(`  [DRY RUN] Would update ${memberCount} "member" → "user"`);
    }

    // Re-fetch primary owner with updated data
    primaryOwner = await UserModel.findById(primaryOwner._id);
    if (!primaryOwner) {
      emit('ERROR: Primary owner not found after update. Aborting.');
      process.exit(1);
    }

    // ─── Step 4: Add subscriptionTier to users missing it ───────────────
    emit('\nStep 4: Setting default subscriptionTier on users...');
    if (!DRY_RUN) {
      const subResult = await UserModel.updateMany(
        { subscriptionTier: { $exists: false } },
        { $set: { subscriptionTier: 'free' } }
      );
      emit(`  Default subscriptionTier set on ${subResult.modifiedCount} users`);
    }

    // ─── Step 5: Create Portfolio documents ─────────────────────────────
    emit('\nStep 5: Creating Portfolio documents...');
    const refreshedUsers = await UserModel.find({});
    let portfoliosCreated = 0;

    for (const user of refreshedUsers) {
      const existingPortfolio = await PortfolioModel.findOne({ ownerId: user._id });
      if (existingPortfolio) {
        emit(`  [SKIP] Portfolio exists for ${user.username || user.email}`);
        continue;
      }

      const username = user.username || generateUsername(user.name);

      if (!DRY_RUN) {
        await PortfolioModel.create({
          ownerId: user._id,
          username,
          slug: username,
          headline: user.bio ? user.bio.substring(0, 100) : undefined,
          bio: user.bio,
          githubUsername: user.githubUsername,
          socialLinks: user.socialLinks,
          theme: 'portfolio-os',
          visibility: 'public',
          analyticsSettings: { enabled: true },
        });
      }
      emit(`  [PORTFOLIO] Created for ${username}`);
      portfoliosCreated++;
    }
    emit(`  Total portfolios created: ${portfoliosCreated}`);

    // ─── Step 6: Set ownerId on orphaned content ────────────────────────
    emit('\nStep 6: Setting ownerId on orphaned content...');
    const ownerId = primaryOwner._id;

    // Projects
    if (!DRY_RUN) {
      const pResult = await ProjectModel.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId } }
      );
      emit(`  Projects: ${pResult.modifiedCount} updated`);
    } else {
      const pCount = await ProjectModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] Projects: ${pCount} would be updated`);
    }

    // Skills
    if (!DRY_RUN) {
      const sResult = await SkillModel.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId } }
      );
      emit(`  Skills: ${sResult.modifiedCount} updated`);
    } else {
      const sCount = await SkillModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] Skills: ${sCount} would be updated`);
    }

    // Experience
    if (!DRY_RUN) {
      const eResult = await ExperienceModel.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId } }
      );
      emit(`  Experiences: ${eResult.modifiedCount} updated`);
    } else {
      const eCount = await ExperienceModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] Experiences: ${eCount} would be updated`);
    }

    // Certifications
    if (!DRY_RUN) {
      const cResult = await CertificationModel.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId } }
      );
      emit(`  Certifications: ${cResult.modifiedCount} updated`);
    } else {
      const cCount = await CertificationModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] Certifications: ${cCount} would be updated`);
    }

    // BlogPosts — set ownerId = authorId for those missing it
    if (!DRY_RUN) {
      const blogs = await BlogPostModel.find({ ownerId: { $exists: false } });
      for (const blog of blogs) {
        blog.ownerId = blog.authorId;
        await blog.save({ validateBeforeSave: false });
      }
      emit(`  BlogPosts: ${blogs.length} updated (ownerId set from authorId)`);
    } else {
      const bCount = await BlogPostModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] BlogPosts: ${bCount} would be updated`);
    }

    // Messages — set portfolioOwnerId
    if (!DRY_RUN) {
      const mResult = await MessageModel.updateMany(
        { portfolioOwnerId: { $exists: false } },
        { $set: { portfolioOwnerId: ownerId } }
      );
      emit(`  Messages: ${mResult.modifiedCount} updated`);
    } else {
      const mCount = await MessageModel.countDocuments({ portfolioOwnerId: { $exists: false } });
      emit(`  [DRY RUN] Messages: ${mCount} would be updated`);
    }

    // Testimonials — set portfolioOwnerId
    if (!DRY_RUN) {
      const tResult = await TestimonialModel.updateMany(
        { portfolioOwnerId: { $exists: false } },
        { $set: { portfolioOwnerId: ownerId } }
      );
      emit(`  Testimonials: ${tResult.modifiedCount} updated`);
    } else {
      const tCount = await TestimonialModel.countDocuments({ portfolioOwnerId: { $exists: false } });
      emit(`  [DRY RUN] Testimonials: ${tCount} would be updated`);
    }

    // Uploads — set ownerId where missing
    if (!DRY_RUN) {
      const uResult = await UploadRecordModel.updateMany(
        { ownerId: { $exists: false } },
        { $set: { ownerId } }
      );
      emit(`  Uploads: ${uResult.modifiedCount} updated`);
    } else {
      const uCount = await UploadRecordModel.countDocuments({ ownerId: { $exists: false } });
      emit(`  [DRY RUN] Uploads: ${uCount} would be updated`);
    }

    // ─── Step 7: Create Subscriptions ───────────────────────────────────
    emit('\nStep 7: Creating Subscription documents...');
    let subscriptionsCreated = 0;

    for (const user of refreshedUsers) {
      const existingSub = await SubscriptionModel.findOne({ userId: user._id });
      if (existingSub) {
        emit(`  [SKIP] Subscription exists for ${user.username || user.email}`);
        continue;
      }

      if (!DRY_RUN) {
        const sub = createDefaultSubscription(user._id);
        // Give superadmin a premium subscription
        if (user.role === 'superadmin') {
          sub.tier = 'premium';
          sub.limits = SUBSCRIPTION_PLAN_LIMITS.premium;
        }
        await sub.save();
      }
      emit(`  [SUBSCRIPTION] Created for ${user.username || user.email}`);
      subscriptionsCreated++;
    }
    emit(`  Total subscriptions created: ${subscriptionsCreated}`);

    // ─── Step 8: Validation ─────────────────────────────────────────────
    emit('\nStep 8: Validation...');
    
    const orphanedProjects = await ProjectModel.countDocuments({ ownerId: { $exists: false } });
    const orphanedSkills = await SkillModel.countDocuments({ ownerId: { $exists: false } });
    const orphanedExperiences = await ExperienceModel.countDocuments({ ownerId: { $exists: false } });
    const orphanedCerts = await CertificationModel.countDocuments({ ownerId: { $exists: false } });
    const usersWithoutUsername = await UserModel.countDocuments({ username: { $exists: false } });
    const usersWithoutPortfolio = refreshedUsers.length - await PortfolioModel.countDocuments({});

    const allPassed = orphanedProjects === 0 && orphanedSkills === 0 && 
                      orphanedExperiences === 0 && orphanedCerts === 0 && 
                      usersWithoutUsername === 0 && usersWithoutPortfolio <= 0;

    emit(`  Projects without ownerId: ${orphanedProjects} ${orphanedProjects === 0 ? '✅' : '❌'}`);
    emit(`  Skills without ownerId: ${orphanedSkills} ${orphanedSkills === 0 ? '✅' : '❌'}`);
    emit(`  Experiences without ownerId: ${orphanedExperiences} ${orphanedExperiences === 0 ? '✅' : '❌'}`);
    emit(`  Certifications without ownerId: ${orphanedCerts} ${orphanedCerts === 0 ? '✅' : '❌'}`);
    emit(`  Users without username: ${usersWithoutUsername} ${usersWithoutUsername === 0 ? '✅' : '❌'}`);
    emit(`  Users without Portfolio: ${usersWithoutPortfolio} ${usersWithoutPortfolio <= 0 ? '✅' : '❌'}`);
    
    emit(`\n${'='.repeat(60)}`);
    emit(`Migration ${allPassed || DRY_RUN ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH ISSUES'}`);
    emit(`Mode: ${DRY_RUN ? 'DRY RUN — no data was modified' : 'LIVE'}`);
    emit(`Finished: ${new Date().toISOString()}`);
    emit(`${'='.repeat(60)}\n`);

    mongoose.connection.close();
  } catch (error) {
    emit(`\nMIGRATION FAILED: ${error}`);
    console.error(error);
    process.exit(1);
  }
}

migrate();
