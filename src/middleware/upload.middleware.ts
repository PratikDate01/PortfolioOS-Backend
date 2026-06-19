import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';

// Set up memory storage
const storage = multer.memoryStorage();

// Define allowed mime types
const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  videos: ['video/mp4', 'video/webm'],
  documents: ['application/pdf']
};

const ALL_ALLOWED_MIMES = [
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.videos,
  ...ALLOWED_MIME_TYPES.documents
];

// File filter to reject unallowed mime types early
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALL_ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: jpg, jpeg, png, webp, mp4, webm, pdf.`));
  }
};

// General multer upload helper (limits to 50MB max, which is our absolute maximum limit for videos)
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Single file middleware handlers
export const uploadSingle = (fieldName: string) => {
  const uploadMiddleware = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds the limit of 50MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

/**
 * Validates uploaded image properties (MIME & size <= 5MB)
 */
export const validateImageUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size } = req.file;

  if (!ALLOWED_MIME_TYPES.images.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid image format. Allowed: jpg, jpeg, png, webp.' });
  }

  const limit = 5 * 1024 * 1024; // 5MB
  if (size > limit) {
    return res.status(400).json({ error: 'Image size exceeds the limit of 5MB.' });
  }

  next();
};

/**
 * Validates uploaded video properties (MIME & size <= 50MB)
 */
export const validateVideoUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size } = req.file;

  if (!ALLOWED_MIME_TYPES.videos.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid video format. Allowed: mp4, webm.' });
  }

  const limit = 50 * 1024 * 1024; // 50MB
  if (size > limit) {
    return res.status(400).json({ error: 'Video size exceeds the limit of 50MB.' });
  }

  next();
};

/**
 * Validates uploaded PDF properties (MIME & size <= 10MB)
 */
export const validatePdfUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size } = req.file;

  if (!ALLOWED_MIME_TYPES.documents.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid document format. Allowed: pdf.' });
  }

  const limit = 10 * 1024 * 1024; // 10MB
  if (size > limit) {
    return res.status(400).json({ error: 'Document size exceeds the limit of 10MB.' });
  }

  next();
};
