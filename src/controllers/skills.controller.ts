import { Request, Response } from 'express';
import { SkillModel } from '../models/skill.model';

export const getSkills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const filter: Record<string, any> = {};

    if (category) {
      filter.category = category;
    }

    const skills = await SkillModel.find(filter).sort({ category: 1, proficiency: -1 });
    res.status(200).json({ data: skills });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing skills' });
  }
};

export const createSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const skill = new SkillModel(req.body);
    await skill.save();
    res.status(201).json({ data: skill });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating skill' });
  }
};

export const updateSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const skill = await SkillModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.status(200).json({ data: skill });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating skill' });
  }
};

export const deleteSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const skill = await SkillModel.findByIdAndDelete(id);
    
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.status(200).json({ data: skill, message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting skill' });
  }
};
