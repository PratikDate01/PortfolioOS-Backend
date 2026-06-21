import { Request, Response } from 'express';
import { ResumeModel } from '../models/resume.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getResumes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username } = req.query;
    const userRole = req.user?.role;
    const isDashboardAccess = !username && req.user?.id;

    if (isDashboardAccess && (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user')) {
      const filter: Record<string, any> = {};
      if (userRole !== 'superadmin') {
        filter.userId = req.user?.id;
      }
      const resumes = await ResumeModel.find(filter).sort({ createdAt: -1 });
      res.status(200).json({ data: resumes });
    } else {
      // Public view gets the active resume for specified username or fallback superadmin
      const filter: Record<string, any> = { isActive: true };
      
      if (username) {
        const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
        if (!user) {
          res.status(200).json({ data: [] });
          return;
        }
        filter.userId = user._id;
      } else {
        const primaryOwner = await UserModel.findOne({ role: 'superadmin' });
        if (primaryOwner) {
          filter.userId = primaryOwner._id;
        } else {
          res.status(200).json({ data: [] });
          return;
        }
      }

      const activeResume = await ResumeModel.findOne(filter);
      res.status(200).json({ data: activeResume ? [activeResume] : [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving resumes' });
  }
};

export const createResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { label, resumeFile, isActive, fileName, mimeType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    if (isActive) {
      // Deactivate all others for this user
      await ResumeModel.updateMany({ userId }, { isActive: false });
    }

    const resume = new ResumeModel({
      label,
      resumeFile,
      isActive,
      userId,
      fileName: fileName || (resumeFile as any).originalName || 'Resume.pdf',
      mimeType: mimeType || (resumeFile as any).mimeType || 'application/pdf'
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
    const { label, resumeFile, isActive, fileName, mimeType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin') {
      filter.userId = userId;
    }

    const resume = await ResumeModel.findOne(filter);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    if (label !== undefined) resume.label = label;
    if (resumeFile !== undefined) {
      resume.resumeFile = resumeFile;
      resume.fileName = fileName || (resumeFile as any).originalName || resume.fileName || 'Resume.pdf';
      resume.mimeType = mimeType || (resumeFile as any).mimeType || resume.mimeType || 'application/pdf';
    } else {
      if (fileName !== undefined) resume.fileName = fileName;
      if (mimeType !== undefined) resume.mimeType = mimeType;
    }
    
    if (isActive === true) {
      // Deactivate all others for this user
      await ResumeModel.updateMany({ userId: resume.userId }, { isActive: false });
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
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin') {
      filter.userId = userId;
    }

    const resume = await ResumeModel.findOneAndDelete(filter);
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
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin') {
      filter.userId = userId;
    }

    const resume = await ResumeModel.findOne(filter);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Deactivate all other resumes for this user
    await ResumeModel.updateMany({ userId: resume.userId }, { isActive: false });

    // Activate this one
    resume.isActive = true;
    await resume.save();

    res.status(200).json({ data: resume, message: 'Resume activated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error activating resume' });
  }
};

/**
 * Stream download the resume PDF file with correct content headers.
 */
export const downloadResume = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const resume = await ResumeModel.findById(id).populate('userId');
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    const fileUrl = resume.resumeFile.secureUrl;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to download file from storage' });
      return;
    }

    const contentType = resume.mimeType || response.headers.get('content-type') || 'application/pdf';
    res.setHeader('Content-Type', contentType);

    // Dynamic sanitized name fallback
    let formattedName = resume.fileName;
    if (!formattedName) {
      const name = (resume.userId as any)?.name || 'Pratik_Date';
      formattedName = `${name.trim().replace(/\s+/g, '_')}_Resume.pdf`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${formattedName}"`);
    
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Server error downloading resume' });
  }
};
