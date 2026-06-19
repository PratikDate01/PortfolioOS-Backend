import { Response } from 'express';
import { CommentModel } from '../models/comment.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

export const getComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    
    // Retrieve comments for the post, populating user details
    const comments = await CommentModel.find({ postId, status: 'visible' })
      .populate('authorId', 'name avatarUrl role')
      .sort({ createdAt: 1 });

    res.status(200).json({ data: comments });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing comments' });
  }
};

export const createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { postId } = req.params;
    const { body, parentCommentId } = req.body;

    const comment = new CommentModel({
      postId,
      authorId: req.user.id,
      body,
      parentCommentId: parentCommentId || undefined,
      status: 'visible'
    });

    await comment.save();
    
    const populated = await comment.populate('authorId', 'name avatarUrl role');

    // Award XP for posting a comment (+30 XP)
    const gamificationResult = await awardXp(req.user.id, 'comment_posted', 30, { postId, commentId: comment._id.toString() });

    res.status(201).json({ data: populated, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ error: 'Server error posting comment' });
  }
};
