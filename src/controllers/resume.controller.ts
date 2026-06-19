import { Request, Response } from 'express';
import { ResumeModel } from '../models/resume.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getResumes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole === 'owner' || userRole === 'admin') {
      const resumes = await ResumeModel.find().sort({ createdAt: -1 });
      res.status(200).json({ data: resumes });
    } else {
      // Public view only gets the active resume
      const activeResume = await ResumeModel.findOne({ isActive: true });
      res.status(200).json({ data: activeResume ? [activeResume] : [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving resumes' });
  }
};

export const createResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { label, resumeFile, isActive } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    if (isActive) {
      // Deactivate all others
      await ResumeModel.updateMany({}, { isActive: false });
    }

    const resume = new ResumeModel({
      label,
      resumeFile,
      isActive,
      userId
    });

    await resume.save();
    res.status(201).json({ data: resume });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating resume' });
  }
};

export const updateResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { label, resumeFile, isActive } = req.body;

    const resume = await ResumeModel.findById(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    if (label !== undefined) resume.label = label;
    if (resumeFile !== undefined) resume.resumeFile = resumeFile;
    
    if (isActive === true) {
      // Deactivate all others
      await ResumeModel.updateMany({}, { isActive: false });
      resume.isActive = true;
    } else if (isActive === false) {
      resume.isActive = false;
    }

    await resume.save();
    res.status(200).json({ data: resume });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating resume' });
  }
};

export const deleteResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const resume = await ResumeModel.findByIdAndDelete(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    res.status(200).json({ data: resume, message: 'Resume deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting resume' });
  }
};

export const setActiveResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resume = await ResumeModel.findById(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Deactivate all other resumes
    await ResumeModel.updateMany({}, { isActive: false });

    // Activate this one
    resume.isActive = true;
    await resume.save();

    res.status(200).json({ data: resume, message: 'Resume activated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error activating resume' });
  }
};
