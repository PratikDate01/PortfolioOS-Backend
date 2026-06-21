import { Request, Response } from 'express';
import { SkillModel } from '../models/skill.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getSkills = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, username } = req.query;
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
      // Public fallback: retrieve primary superadmin's skills
      const primaryOwner = await UserModel.findOne({ role: 'superadmin' });
      if (primaryOwner) {
        filter.ownerId = primaryOwner._id;
      } else {
        res.status(200).json({ data: [] });
        return;
      }
    }

    if (category) {
      filter.category = category;
    }

    const skills = await SkillModel.find(filter).sort({ category: 1, proficiency: -1 });
    res.status(200).json({ data: skills });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing skills' });
  }
};

export const createSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const skillData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    skillData.ownerId = ownerId;

    // Verify uniqueness of skill name per owner
    const existing = await SkillModel.findOne({ ownerId, name: { $regex: new RegExp(`^${skillData.name}$`, 'i') } });
    if (existing) {
      res.status(400).json({ error: 'A skill with this name already exists in your portfolio' });
      return;
    }

    const skill = new SkillModel(skillData);
    await skill.save();
    res.status(201).json({ data: skill });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating skill' });
  }
};

export const updateSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const skill = await SkillModel.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
    
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.status(200).json({ data: skill });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating skill' });
  }
};

export const deleteSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const skill = await SkillModel.findOneAndDelete(filter);
    
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.status(200).json({ data: skill, message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting skill' });
  }
};
