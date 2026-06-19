import { Router } from 'express';
import { getBlogPosts, getBlogPostBySlug, createBlogPost, updateBlogPost, deleteBlogPost } from '../controllers/blog.controller';
import { getComments, createComment } from '../controllers/comments.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { blogPostSchema, commentSchema } from '../middleware/schemas';

const router = Router();

// Blog post routes
router.get('/', optionalProtect, getBlogPosts);
router.get('/:slug', optionalProtect, getBlogPostBySlug);

// Admin-only blog operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(blogPostSchema), createBlogPost);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(blogPostSchema), updateBlogPost);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteBlogPost);

// Comment routes (nested under blog posts)
router.get('/:postId/comments', optionalProtect, getComments);
router.post('/:postId/comments', protect, validate(commentSchema), createComment);

export default router;
