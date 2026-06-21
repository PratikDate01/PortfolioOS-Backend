import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { validateFileSignature } from '../utils/fileSignature';

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

// General multer upload helper (limits to 50MB max)
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Malware scan hook placeholder
const scanForMalware = async (buffer: Buffer): Promise<boolean> => {
  // Hook for VirusTotal, ClamAV or cloud provider scanners.
  // Return true by default.
  return true;
};

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
 * Validates uploaded image properties (MIME, magic bytes, size <= 5MB, malware check)
 */
export const validateImageUpload = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size, buffer } = req.file;

  if (!ALLOWED_MIME_TYPES.images.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid image format. Allowed: jpg, jpeg, png, webp.' });
  }

  // Magic bytes signature validation
  const signature = validateFileSignature(buffer);
  if (!signature.isValid || !signature.detectedMime || !ALLOWED_MIME_TYPES.images.includes(signature.detectedMime)) {
    return res.status(400).json({ error: 'MIME type spoofing detected. Invalid image file header.' });
  }

  const limit = 5 * 1024 * 1024; // 5MB
  if (size > limit) {
    return res.status(400).json({ error: 'Image size exceeds the limit of 5MB.' });
  }

  // Malware scan check
  const isSafe = await scanForMalware(buffer);
  if (!isSafe) {
    return res.status(400).json({ error: 'Malicious upload content detected.' });
  }

  next();
};

/**
 * Validates uploaded video properties (MIME, magic bytes, size <= 50MB, malware check)
 */
export const validateVideoUpload = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size, buffer } = req.file;

  if (!ALLOWED_MIME_TYPES.videos.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid video format. Allowed: mp4, webm.' });
  }

  // Magic bytes signature validation
  const signature = validateFileSignature(buffer);
  if (!signature.isValid || !signature.detectedMime || !ALLOWED_MIME_TYPES.videos.includes(signature.detectedMime)) {
    return res.status(400).json({ error: 'MIME type spoofing detected. Invalid video file header.' });
  }

  const limit = 50 * 1024 * 1024; // 50MB
  if (size > limit) {
    return res.status(400).json({ error: 'Video size exceeds the limit of 50MB.' });
  }

  // Malware scan check
  const isSafe = await scanForMalware(buffer);
  if (!isSafe) {
    return res.status(400).json({ error: 'Malicious upload content detected.' });
  }

  next();
};

/**
 * Validates uploaded PDF properties (MIME, magic bytes, size <= 10MB, malware check)
 */
export const validatePdfUpload = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { mimetype, size, buffer } = req.file;

  if (!ALLOWED_MIME_TYPES.documents.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid document format. Allowed: pdf.' });
  }

  // Magic bytes signature validation
  const signature = validateFileSignature(buffer);
  if (!signature.isValid || !signature.detectedMime || !ALLOWED_MIME_TYPES.documents.includes(signature.detectedMime)) {
    return res.status(400).json({ error: 'MIME type spoofing detected. Invalid document file header.' });
  }

  const limit = 10 * 1024 * 1024; // 10MB
  if (size > limit) {
    return res.status(400).json({ error: 'Document size exceeds the limit of 10MB.' });
  }

  // Malware scan check
  const isSafe = await scanForMalware(buffer);
  if (!isSafe) {
    return res.status(400).json({ error: 'Malicious upload content detected.' });
  }

  next();
};
