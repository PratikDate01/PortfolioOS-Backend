import { Request, Response } from 'express';
import { ExperienceModel } from '../models/experience.model';

export const getExperiences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const filter: Record<string, any> = {};

    if (type) {
      filter.type = type;
    }

    const experiences = await ExperienceModel.find(filter).sort({ startDate: -1, order: 1 });
    res.status(200).json({ data: experiences });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing experiences' });
  }
};

export const createExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const exp = new ExperienceModel(req.body);
    await exp.save();
    res.status(201).json({ data: exp });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating experience' });
  }
};

export const updateExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const exp = await ExperienceModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    
    if (!exp) {
      res.status(404).json({ error: 'Experience not found' });
      return;
    }
    res.status(200).json({ data: exp });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating experience' });
  }
};

export const deleteExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const exp = await ExperienceModel.findByIdAndDelete(id);
    
    if (!exp) {
      res.status(404).json({ error: 'Experience not found' });
      return;
    }
    res.status(200).json({ data: exp, message: 'Experience deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting experience' });
  }
};
