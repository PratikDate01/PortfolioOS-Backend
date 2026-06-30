import { Request, Response } from 'express';
import { SkillModel } from '../models/skill.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const escapeRegex = (str: string): string => {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

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
      res.status(400).json({ error: 'username query parameter is required for public requests' });
      return;
    }

    if (category) {
      filter.category = category;
    }

    const skills = await SkillModel.find(filter).sort({ category: 1, proficiency: -1 });
    res.status(200).json({ data: skills });
  } catch (error) {
    console.error('Error listing skills:', error);
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

    // Verify uniqueness of skill name per owner (escaped case-insensitive regex check)
    const escapedName = escapeRegex(skillData.name);
    const existing = await SkillModel.findOne({ ownerId, name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
    if (existing) {
      res.status(400).json({ error: 'A skill with this name already exists in your portfolio' });
      return;
    }

    const skill = new SkillModel(skillData);
    await skill.save();
    res.status(201).json({ data: skill });
  } catch (error) {
    console.error('Error creating skill:', error);
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

    const skill = await SkillModel.findById(id);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    if (skill.ownerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to edit this resource' });
      return;
    }

    const updated = await SkillModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    res.status(200).json({ data: updated });
  } catch (error) {
    console.error('Error updating skill:', error);
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

    const skill = await SkillModel.findById(id);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    if (skill.ownerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to delete this resource' });
      return;
    }

    await SkillModel.findByIdAndDelete(id);
    res.status(200).json({ data: skill, message: 'Skill deleted successfully' });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Server error deleting skill' });
  }
};
