import { Response } from 'express';
import { MessageModel } from '../models/message.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

export const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = {};
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.portfolioOwnerId = ownerId;
    }

    if (status) {
      filter.status = status;
    }

    const messages = await MessageModel.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ data: messages });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing messages' });
  }
};

export const createMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const msgData = req.body;

    // Resolve portfolioOwnerId if username is provided instead of ID
    if (!msgData.portfolioOwnerId && msgData.username) {
      const user = await UserModel.findOne({ username: String(msgData.username).toLowerCase().trim() });
      if (user) {
        msgData.portfolioOwnerId = user._id;
      }
    }

    if (!msgData.portfolioOwnerId) {
      res.status(400).json({ error: 'portfolioOwnerId is required' });
      return;
    }

    const msg = new MessageModel(msgData);
    await msg.save();

    let gamificationResult = null;
    if (req.user?.id) {
      gamificationResult = await awardXp(req.user.id, 'message_sent', 100, { messageId: msg._id.toString() });
    }

    res.status(201).json({ data: msg, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating message' });
  }
};

export const updateMessageStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.portfolioOwnerId = ownerId;
    }

    const msg = await MessageModel.findOneAndUpdate(filter, { status }, { new: true, runValidators: true });
    
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.status(200).json({ data: msg });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating message status' });
  }
};
