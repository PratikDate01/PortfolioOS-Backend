import { Request, Response } from 'express';
import { BlogPostModel } from '../models/blogPost.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

const calculateReadingTime = (text: string): number => {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const getBlogPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, tag, status } = req.query;
    const filter: Record<string, any> = {};

    const userRole = req.user?.role;
    if (userRole === 'owner' || userRole === 'admin') {
      if (status) {
        filter.status = status;
      }
    } else {
      filter.status = 'published';
    }

    if (category) filter.categories = category;
    if (tag) filter.tags = tag;

    const posts = await BlogPostModel.find(filter)
      .populate('authorId', 'name avatarUrl')
      .sort({ publishedAt: -1, createdAt: -1 });

    res.status(200).json({ data: posts });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing blog posts' });
  }
};

export const getBlogPostBySlug = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const post = await BlogPostModel.findOne({ slug }).populate('authorId', 'name avatarUrl bio');

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
    
    // Automatically generate slug from title if missing
    if (!postData.slug && postData.title) {
      postData.slug = postData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify slug uniqueness
    const existing = await BlogPostModel.findOne({ slug: postData.slug });
    if (existing) {
      res.status(400).json({ error: 'A blog post with this slug or title already exists' });
      return;
    }

    // Calculate reading time
    const readingTimeMinutes = calculateReadingTime(postData.contentMarkdown || '');

    const post = new BlogPostModel({
      ...postData,
      authorId: req.user.id,
      readingTimeMinutes,
      publishedAt: postData.status === 'published' ? new Date() : undefined
    });

    await post.save();
    res.status(201).json({ data: post });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating blog post' });
  }
};

export const updateBlogPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.contentMarkdown) {
      updateData.readingTimeMinutes = calculateReadingTime(updateData.contentMarkdown);
    }

    if (updateData.status === 'published') {
      const existing = await BlogPostModel.findById(id);
      if (existing && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const post = await BlogPostModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    res.status(200).json({ data: post });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating blog post' });
  }
};

export const deleteBlogPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await BlogPostModel.findByIdAndDelete(id);
    
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    res.status(200).json({ data: post, message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting blog post' });
  }
};
