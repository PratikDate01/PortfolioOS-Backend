import { Request, Response } from 'express';
import { CertificationModel } from '../models/certification.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getCertifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const filter: Record<string, any> = {};

    if (category) {
      filter.category = category;
    }

    const certifications = await CertificationModel.find(filter).sort({ issueDate: -1 });
    res.status(200).json({ data: certifications });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing certifications' });
  }
};

export const getCertificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const certification = await CertificationModel.findById(id);

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
    const certification = new CertificationModel(certData);
    await certification.save();
    res.status(201).json({ data: certification });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating certification' });
  }
};

export const updateCertification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const certData = req.body;

    const certification = await CertificationModel.findByIdAndUpdate(id, certData, {
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

export const deleteCertification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const certification = await CertificationModel.findByIdAndDelete(id);

    if (!certification) {
      res.status(404).json({ error: 'Certification not found' });
      return;
    }

    res.status(200).json({ data: certification, message: 'Certification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting certification' });
  }
};
