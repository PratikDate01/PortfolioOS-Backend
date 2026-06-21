import { Request, Response } from 'express';
import { BlogPostModel } from '../models/blogPost.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

const calculateReadingTime = (text: string): number => {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const getBlogPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, tag, status, username } = req.query;
    const filter: Record<string, any> = {};

    // Enforce tenant boundary
    if (username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (!user) {
        res.status(200).json({ data: [] });
        return;
      }
      filter.ownerId = user._id;
    } else if (req.user?.id) {
      filter.ownerId = req.user.id;
    } else {
      // Public fallback: retrieve primary superadmin's posts
      const primaryOwner = await UserModel.findOne({ role: 'superadmin' });
      if (primaryOwner) {
        filter.ownerId = primaryOwner._id;
      } else {
        res.status(200).json({ data: [] });
        return;
      }
    }

    const userRole = req.user?.role;
    const isOwner = req.user?.id && filter.ownerId && req.user.id.toString() === filter.ownerId.toString();
    const isAdmin = userRole === 'superadmin' || userRole === 'admin';

    if (isAdmin || isOwner) {
      if (status) {
        filter.status = status;
      }
    } else {
      filter.status = 'published';
    }

    if (category) filter.categories = category;
    if (tag) filter.tags = tag;

    const page = parseInt(req.query.page as string, 10);
    const limit = parseInt(req.query.limit as string, 10);

    const postsQuery = BlogPostModel.find(filter)
      .populate('authorId', 'name avatarUrl')
      .sort({ publishedAt: -1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      const total = await BlogPostModel.countDocuments(filter);
      const posts = await postsQuery.skip(skip).limit(limit);
      res.status(200).json({
        data: posts,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      const posts = await postsQuery;
      res.status(200).json({ data: posts });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error listing blog posts' });
  }
};

export const getBlogPostBySlug = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { username } = req.query;
    const filter: Record<string, any> = { slug };

    if (username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (!user) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      filter.ownerId = user._id;
    } else if (req.user?.id) {
      filter.ownerId = req.user.id;
    } else {
      const primaryOwner = await UserModel.findOne({ role: 'superadmin' });
      if (primaryOwner) {
        filter.ownerId = primaryOwner._id;
      } else {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
    }

    const post = await BlogPostModel.findOne(filter).populate('authorId', 'name avatarUrl bio');

    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    // Increment viewCount asynchronously
    post.viewCount = (post.viewCount || 0) + 1;
    await post.save();

    // Award XP for reading blog post (+10 XP)
    let gamificationResult = null;
    if (req.user?.id) {
      gamificationResult = await awardXp(req.user.id, 'project_view', 10, { blogSlug: slug, blogId: post._id.toString() });
    }

    res.status(200).json({ data: post, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving blog post' });
  }
};

export const createBlogPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const postData = req.body;
    const ownerId = req.user.id;
    
    // Automatically generate slug from title if missing
    if (!postData.slug && postData.title) {
      postData.slug = postData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify slug uniqueness per owner
    const existing = await BlogPostModel.findOne({ ownerId, slug: postData.slug });
    if (existing) {
      res.status(400).json({ error: 'A blog post with this slug or title already exists in your portfolio' });
      return;
    }

    // Calculate reading time
    const readingTimeMinutes = calculateReadingTime(postData.contentMarkdown || '');

    const post = new BlogPostModel({
      ...postData,
      ownerId,
      authorId: ownerId,
      readingTimeMinutes,
      publishedAt: postData.status === 'published' ? new Date() : undefined
    });

    await post.save();
    res.status(201).json({ data: post });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating blog post' });
  }
};

export const updateBlogPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (updateData.contentMarkdown) {
      updateData.readingTimeMinutes = calculateReadingTime(updateData.contentMarkdown);
    }

    if (updateData.status === 'published') {
      const existing = await BlogPostModel.findById(id);
      if (existing && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin') {
      filter.ownerId = ownerId;
    }

    const post = await BlogPostModel.findOneAndUpdate(filter, updateData, { new: true, runValidators: true });
    
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    res.status(200).json({ data: post });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating blog post' });
  }
};

export const deleteBlogPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin') {
      filter.ownerId = ownerId;
    }

    const post = await BlogPostModel.findOneAndDelete(filter);
    
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    res.status(200).json({ data: post, message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting blog post' });
  }
};
