import { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary';
// @ts-ignore
import streamifier from 'streamifier';

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video' | 'raw';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
}

/**
 * Returns the folder path structure in Cloudinary.
 * Supports future SaaS multi-tenancy by partitioning by userId if provided.
 */
export const getCloudinaryFolder = (folderName: string, userId?: string): string => {
  const base = 'portfolio-os';
  if (userId) {
    return `${base}/users/${userId}/${folderName}`;
  }
  return `${base}/${folderName}`;
};

/**
 * Uploads a file buffer to Cloudinary using a stream.
 */
const uploadStream = (
  fileBuffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured) {
      return reject(new Error('Cloudinary is not configured. Upload failed.'));
    }

    const upload_stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error('Upload succeeded but no result was returned.'));
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(upload_stream);
  });
};

/**
 * Upload an Image to Cloudinary
 */
export const uploadImage = async (
  fileBuffer: Buffer,
  folder: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
  const uploadOptions: UploadApiOptions = {
    folder,
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' } // Auto-optimize
    ],
    ...options
  };

  const response = await uploadStream(fileBuffer, uploadOptions);
  return {
    publicId: response.public_id,
    secureUrl: response.secure_url,
    resourceType: 'image',
    format: response.format,
    bytes: response.bytes,
    width: response.width,
    height: response.height,
    uploadedAt: new Date(response.created_at || Date.now())
  };
};

/**
 * Upload a Video to Cloudinary
 */
export const uploadVideo = async (
  fileBuffer: Buffer,
  folder: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
  const uploadOptions: UploadApiOptions = {
    folder,
    resource_type: 'video',
    chunk_size: 6000000, // 6MB chunk size for streaming optimization
    ...options
  };

  const response = await uploadStream(fileBuffer, uploadOptions);
  return {
    publicId: response.public_id,
    secureUrl: response.secure_url,
    resourceType: 'video',
    format: response.format,
    bytes: response.bytes,
    width: response.width,
    height: response.height,
    uploadedAt: new Date(response.created_at || Date.now())
  };
};

/**
 * Upload a PDF to Cloudinary
 */
export const uploadPdf = async (
  fileBuffer: Buffer,
  folder: string,
  options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
  const uploadOptions: UploadApiOptions = {
    folder,
    resource_type: 'raw', // PDFs as raw or auto
    ...options
  };

  const response = await uploadStream(fileBuffer, uploadOptions);
  return {
    publicId: response.public_id,
    secureUrl: response.secure_url,
    resourceType: 'raw',
    format: response.format || 'pdf',
    bytes: response.bytes,
    uploadedAt: new Date(response.created_at || Date.now())
  };
};

/**
 * Delete an Asset from Cloudinary
 */
export const deleteAsset = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ result: string }> => {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured. Delete failed.');
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });
};

/**
 * Replace an existing asset with a new one
 */
export const replaceAsset = async (
  oldPublicId: string,
  newFileBuffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
  options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
  // 1. Delete old asset
  try {
    await deleteAsset(oldPublicId, resourceType);
  } catch (error) {
    console.warn(`Failed to delete old asset ${oldPublicId} during replacement:`, error);
  }

  // 2. Upload new asset
  if (resourceType === 'video') {
    return uploadVideo(newFileBuffer, folder, options);
  } else if (resourceType === 'raw') {
    return uploadPdf(newFileBuffer, folder, options);
  } else {
    return uploadImage(newFileBuffer, folder, options);
  }
};

/**
 * Transform an asset URL with options
 */
export const transformAssetUrl = (publicId: string, options: Record<string, any> = {}): string => {
  if (!isCloudinaryConfigured) return '';
  return cloudinary.url(publicId, { secure: true, ...options });
};

/**
 * Generate an Optimized Image URL (auto quality, webp, etc.)
 */
export const generateOptimizedUrl = (publicId: string, options: Record<string, any> = {}): string => {
  return transformAssetUrl(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    ...options
  });
};
