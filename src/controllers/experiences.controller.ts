import { Request, Response } from 'express';
import { ExperienceModel } from '../models/experience.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getExperiences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, username } = req.query;
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
      // Public fallback: retrieve primary superadmin's experiences
      const primaryOwner = await UserModel.findOne({ role: 'superadmin' });
      if (primaryOwner) {
        filter.ownerId = primaryOwner._id;
      } else {
        res.status(200).json({ data: [] });
        return;
      }
    }

    if (type) {
      filter.type = type;
    }

    const experiences = await ExperienceModel.find(filter).sort({ startDate: -1, order: 1 });
    res.status(200).json({ data: experiences });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing experiences' });
  }
};

export const createExperience = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const expData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    expData.ownerId = ownerId;

    const exp = new ExperienceModel(expData);
    await exp.save();
    res.status(201).json({ data: exp });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating experience' });
  }
};

export const updateExperience = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const exp = await ExperienceModel.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
    
    if (!exp) {
      res.status(404).json({ error: 'Experience not found' });
      return;
    }
    res.status(200).json({ data: exp });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating experience' });
  }
};

export const deleteExperience = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const exp = await ExperienceModel.findOneAndDelete(filter);
    
    if (!exp) {
      res.status(404).json({ error: 'Experience not found' });
      return;
    }
    res.status(200).json({ data: exp, message: 'Experience deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting experience' });
  }
};
