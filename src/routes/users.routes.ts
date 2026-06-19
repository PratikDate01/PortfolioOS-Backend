import { Router, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { protect, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { changePasswordSchema } from '../middleware/schemas';
import { UserModel } from '../models/user.model';
import { UserProgressModel } from '../models/userProgress.model';
import { BookmarkModel } from '../models/bookmark.model';
import { ProjectModel } from '../models/project.model';
import { BlogPostModel } from '../models/blogPost.model';
import { awardXp } from '../services/gamification';

const router = Router();

// GET /api/v1/users/me/progress - fetch level, xp, badges, and recent logs
router.get('/me/progress', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const user = await UserModel.findById(userId).populate('badgeIds');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const logs = await UserProgressModel.find({ userId }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      data: {
        xp: user.xp,
        level: user.level,
        badges: user.badgeIds,
        recentActivity: logs
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user progress' });
  }
});

// GET /api/v1/users/me/bookmarks - list all user bookmarks with content details
router.get('/me/bookmarks', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const bookmarks = await BookmarkModel.find({ userId });

    const populated = await Promise.all(
      bookmarks.map(async (b) => {
        let details = null;
        if (b.targetType === 'project') {
          details = await ProjectModel.findById(b.targetId);
        } else if (b.targetType === 'blogpost') {
          details = await BlogPostModel.findById(b.targetId);
        }
        return {
          _id: b._id,
          targetType: b.targetType,
          targetId: b.targetId,
          details
        };
      })
    );

    res.status(200).json({ data: populated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// POST /api/v1/users/me/bookmarks - toggle a user's bookmark
router.post('/me/bookmarks', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { targetType, targetId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }
    if (!targetType || !targetId) {
      res.status(400).json({ error: 'targetType and targetId are required' });
      return;
    }

    let exists = false;
    if (targetType === 'project') {
      exists = !!(await ProjectModel.findById(targetId));
    } else if (targetType === 'blogpost') {
      exists = !!(await BlogPostModel.findById(targetId));
    }

    if (!exists) {
      res.status(404).json({ error: 'Target content not found' });
      return;
    }

    const existing = await BookmarkModel.findOne({ userId, targetType, targetId });

    if (existing) {
      await BookmarkModel.deleteOne({ _id: existing._id });
      res.status(200).json({ data: { bookmarked: false } });
    } else {
      const bookmark = new BookmarkModel({ userId, targetType, targetId });
      await bookmark.save();

      // Award XP for bookmarking!
      const gamificationResult = await awardXp(userId, 'project_view', 15, { targetType, targetId });

      res.status(201).json({
        data: {
          bookmarked: true,
          bookmark,
          gamification: gamificationResult
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

// PATCH /api/v1/users/me/profile - update profile details
router.patch('/me/profile', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, bio, socialLinks } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (socialLinks) {
      user.socialLinks = {
        github: socialLinks.github,
        linkedin: socialLinks.linkedin,
        twitter: socialLinks.twitter,
        website: socialLinks.website
      };
    }

    await user.save();
    res.status(200).json({ data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/v1/users/me/password - change password
router.post('/me/password', protect, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.authProvider !== 'local') {
      res.status(400).json({ error: 'Password change is only supported for accounts registered with email and password' });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({ error: 'User does not have a local password' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = passwordHash;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
