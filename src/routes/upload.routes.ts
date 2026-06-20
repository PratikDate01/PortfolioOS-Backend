import { Router, Response } from 'express';
import { protect, restrictTo, AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  uploadSingle,
  validateImageUpload,
  validateVideoUpload,
  validatePdfUpload
} from '../middleware/upload.middleware';
import {
  uploadImage,
  uploadVideo,
  uploadPdf,
  deleteAsset,
  getCloudinaryFolder
} from '../services/cloudinaryService';
import { UploadRecordModel } from '../models/upload.model';

const router = Router();

// Helper to handle upload response and db logging
const handleUpload = async (
  req: AuthenticatedRequest,
  res: Response,
  folderName: string,
  uploadFn: (buffer: Buffer, folder: string) => Promise<any>
) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const ownerId = req.user?.id;
    const folder = getCloudinaryFolder(folderName, ownerId);

    // Perform Cloudinary upload
    const result = await uploadFn(req.file.buffer, folder);

    // Save upload log to database
    const record = new UploadRecordModel({
      publicId: result.publicId,
      secureUrl: result.secureUrl,
      resourceType: result.resourceType,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      originalName: req.file.originalname,
      folder,
      ownerId: ownerId ? ownerId as any : undefined
    });

    await record.save();

    res.status(201).json({
      data: {
        publicId: result.publicId,
        secureUrl: result.secureUrl,
        resourceType: result.resourceType,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        uploadedAt: result.uploadedAt
      }
    });
  } catch (error: any) {
    console.error(`Upload error in folder ${folderName}:`, error);
    res.status(500).json({ error: 'Failed to upload media asset', details: error.message });
  }
};

// GET /api/v1/upload - List all uploaded assets (Media Manager)
router.get('/', protect, restrictTo('owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resourceType, search } = req.query;
    const filter: Record<string, any> = {};

    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      filter.ownerId = req.user?.id;
    }

    if (resourceType) {
      filter.resourceType = resourceType;
    }

    if (search) {
      filter.originalName = { $regex: search as string, $options: 'i' };
    }

    // Return uploads, sorted by most recent
    const uploads = await UploadRecordModel.find(filter).sort({ uploadedAt: -1 });
    res.status(200).json({ data: uploads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve uploads' });
  }
});

// POST /api/v1/upload/profile
router.post(
  '/profile',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  validateImageUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    await handleUpload(req, res, 'profiles', uploadImage);
  }
);

// POST /api/v1/upload/project-image
router.post(
  '/project-image',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  validateImageUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    await handleUpload(req, res, 'projects', uploadImage);
  }
);

// POST /api/v1/upload/project-video
router.post(
  '/project-video',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  validateVideoUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    await handleUpload(req, res, 'projects/videos', uploadVideo);
  }
);

// POST /api/v1/upload/resume
router.post(
  '/resume',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  validatePdfUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    await handleUpload(req, res, 'resumes', uploadPdf);
  }
);

// POST /api/v1/upload/certificate
router.post(
  '/certificate',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    // Certificate can be PDF or Image, perform dynamic routing
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    if (req.file.mimetype === 'application/pdf') {
      validatePdfUpload(req, res, next);
    } else {
      validateImageUpload(req, res, next);
    }
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const isPdf = req.file?.mimetype === 'application/pdf';
    await handleUpload(req, res, 'certifications', isPdf ? uploadPdf : uploadImage);
  }
);

// POST /api/v1/upload/blog-cover
router.post(
  '/blog-cover',
  protect,
  restrictTo('owner', 'admin'),
  uploadSingle('file'),
  validateImageUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    await handleUpload(req, res, 'blogs', uploadImage);
  }
);

// DELETE /api/v1/upload/:publicId (supports path parameters or query string for publicId containing slashes)
router.delete(
  '/:publicId(*)',
  protect,
  restrictTo('owner', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let publicId = req.params.publicId || (req.query.publicId as string);

      if (!publicId) {
        res.status(400).json({ error: 'publicId parameter is required' });
        return;
      }

      // Find the record to get resourceType and owner
      const record = await UploadRecordModel.findOne({ publicId });
      if (!record) {
        res.status(404).json({ error: 'Upload record not found' });
        return;
      }

      // Verify ownership
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        if (record.ownerId && record.ownerId.toString() !== req.user?.id) {
          res.status(403).json({ error: 'You do not have permission to delete this asset' });
          return;
        }
      }

      const resourceType = record.resourceType || 'image';

      // Delete from Cloudinary
      await deleteAsset(publicId, resourceType);

      // Delete from Database
      await UploadRecordModel.deleteOne({ publicId });

      res.status(200).json({ message: 'Media asset deleted successfully', data: { publicId } });
    } catch (error: any) {
      console.error(`Delete error for publicId:`, error);
      res.status(500).json({ error: 'Failed to delete media asset', details: error.message });
    }
  }
);

export default router;
