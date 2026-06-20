import { Request, Response } from 'express';
import { CertificationModel } from '../models/certification.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getCertifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      // Public fallback: retrieve primary superadmin's certifications
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

    const certifications = await CertificationModel.find(filter).sort({ issueDate: -1 });
    res.status(200).json({ data: certifications });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing certifications' });
  }
};

export const getCertificationById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter: Record<string, any> = { _id: id };
    
    if (req.user?.id && req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.ownerId = req.user.id;
    }

    const certification = await CertificationModel.findOne(filter);

    if (!certification) {
      res.status(404).json({ error: 'Certification not found' });
      return;
    }

    res.status(200).json({ data: certification });
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving certification' });
  }
};

export const createCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const certData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    certData.ownerId = ownerId;

    const certification = new CertificationModel(certData);
    await certification.save();
    res.status(201).json({ data: certification });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating certification' });
  }
};

export const updateCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const certData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.ownerId = ownerId;
    }

    const certification = await CertificationModel.findOneAndUpdate(filter, certData, {
      new: true,
      runValidators: true,
    });

    if (!certification) {
      res.status(404).json({ error: 'Certification not found' });
      return;
    }

    res.status(200).json({ data: certification });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating certification' });
  }
};

export const deleteCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = { _id: id };
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.ownerId = ownerId;
    }

    const certification = await CertificationModel.findOneAndDelete(filter);

    if (!certification) {
      res.status(404).json({ error: 'Certification not found' });
      return;
    }

    res.status(200).json({ data: certification, message: 'Certification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting certification' });
  }
};
