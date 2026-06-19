import { Response } from 'express';
import { MessageModel } from '../models/message.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

export const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};

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
    const msg = new MessageModel(req.body);
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

    const msg = await MessageModel.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.status(200).json({ data: msg });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating message status' });
  }
};
