process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-secure-and-long-enough-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-that-is-secure-and-long-enough-32-chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { UploadRecordModel } from '../models/upload.model';
import * as cloudinaryService from '../services/cloudinaryService';

const JWT_SECRET = process.env.JWT_SECRET as string;

// Mock database model
jest.mock('../models/upload.model', () => {
  const mockModel = {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([
      {
        _id: 'mock-upload-id-1',
        publicId: 'portfolio-os/profiles/abc',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio-os/profiles/abc.png',
        resourceType: 'image',
        format: 'png',
        bytes: 2048,
        originalName: 'test.png',
        uploadedAt: new Date()
      }
    ]),
    findOne: jest.fn().mockResolvedValue({
      publicId: 'portfolio-os/profiles/abc',
      resourceType: 'image'
    }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
  };

  const modelConstructor = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue(true)
    };
  });

  const MockedUploadRecordModel = Object.assign(modelConstructor, mockModel);

  return {
    __esModule: true,
    UploadRecordModel: MockedUploadRecordModel,
    default: MockedUploadRecordModel
  };
});

// Mock Cloudinary SDK/Service functions
jest.mock('../services/cloudinaryService', () => {
  return {
    __esModule: true,
    uploadImage: jest.fn().mockResolvedValue({
      publicId: 'portfolio-os/profiles/abc',
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio-os/profiles/abc.png',
      resourceType: 'image',
      format: 'png',
      bytes: 2048,
      width: 400,
      height: 400,
      uploadedAt: new Date()
    }),
    uploadVideo: jest.fn().mockResolvedValue({
      publicId: 'portfolio-os/projects/videos/xyz',
      secureUrl: 'https://res.cloudinary.com/demo/video/upload/v1/portfolio-os/projects/videos/xyz.mp4',
      resourceType: 'video',
      format: 'mp4',
      bytes: 1024 * 1024,
      uploadedAt: new Date()
    }),
    uploadPdf: jest.fn().mockResolvedValue({
      publicId: 'portfolio-os/resumes/res',
      secureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio-os/resumes/res.pdf',
      resourceType: 'raw',
      format: 'pdf',
      bytes: 512 * 1024,
      uploadedAt: new Date()
    }),
    deleteAsset: jest.fn().mockResolvedValue({ result: 'ok' }),
    getCloudinaryFolder: jest.fn().mockImplementation((folder, userId) => `portfolio-os/${folder}`)
  };
});

describe('Cloudinary Media Upload Integration Tests', () => {
  const token = jwt.sign({ id: 'test-admin-id', role: 'owner', email: 'admin@portfolio-os.local' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Gateways', () => {
    it('should reject upload calls without authorization headers', async () => {
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .attach('file', Buffer.from('small-image-content'), 'profile.png');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Not authorized, no token provided');
    });

    it('should reject upload calls for non-owner and non-admin users', async () => {
      const guestToken = jwt.sign({ id: 'test-guest-id', role: 'guest', email: 'guest@portfolio-os.local' }, JWT_SECRET);
      
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .attach('file', Buffer.from('small-image-content'), 'profile.png');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'You do not have permission to perform this action');
    });
  });

  describe('Profile Image Upload Validation (5MB Limit)', () => {
    it('should successfully upload a valid small PNG image', async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]);
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pngHeader, 'profile.png');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('publicId', 'portfolio-os/profiles/abc');
      expect(response.body.data).toHaveProperty('secureUrl');
      expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(1);
    });

    it('should reject a file with an invalid MIME type (e.g. text/plain)', async () => {
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-text-content'), 'profile.txt');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid file type');
    });

    it('should reject an image that exceeds the 5MB size limit', async () => {
      // Create a 6MB dummy buffer with valid PNG magic bytes
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      largeBuffer.writeUInt32BE(0x89504E47, 0);
      largeBuffer.writeUInt32BE(0x0D0A1A0A, 4);
      
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeBuffer, 'huge-profile.png');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Image size exceeds the limit of 5MB');
    });
  });

  describe('Project Video Upload Validation (50MB Limit)', () => {
    it('should successfully upload a valid small MP4 video', async () => {
      const mp4Header = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x00, 0x00, 0x00, 0x00]);
      const response = await request(app)
        .post('/api/v1/upload/project-video')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', mp4Header, 'demo.mp4');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('resourceType', 'video');
      expect(cloudinaryService.uploadVideo).toHaveBeenCalledTimes(1);
    });

    it('should reject a video that exceeds the 50MB size limit', async () => {
      // Create a 51MB dummy buffer with valid MP4 magic bytes
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
      largeBuffer.writeUInt32BE(0x00000018, 0);
      largeBuffer.writeUInt32BE(0x66747970, 4);
      
      const response = await request(app)
        .post('/api/v1/upload/project-video')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeBuffer, 'huge-video.mp4');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('size exceeds');
    });
  });

  describe('Resume PDF Upload Validation (10MB Limit)', () => {
    it('should successfully upload a valid PDF document', async () => {
      const response = await request(app)
        .post('/api/v1/upload/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('%PDF-1.4 test resume content'), 'resume.pdf');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('format', 'pdf');
      expect(cloudinaryService.uploadPdf).toHaveBeenCalledTimes(1);
    });

    it('should reject a PDF that exceeds the 10MB size limit', async () => {
      // Create an 11MB dummy buffer with valid PDF magic bytes
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      largeBuffer.writeUInt32BE(0x25504446, 0);
      
      const response = await request(app)
        .post('/api/v1/upload/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeBuffer, 'huge-resume.pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Document size exceeds the limit of 10MB');
    });
  });

  describe('Asset Deletion API', () => {
    it('should successfully request deletion and sync with database', async () => {
      const response = await request(app)
        .delete('/api/v1/upload/portfolio-os/profiles/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Media asset deleted successfully');
      expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith('portfolio-os/profiles/abc', 'image');
      expect(UploadRecordModel.deleteOne).toHaveBeenCalledWith({ publicId: 'portfolio-os/profiles/abc' });
    });
  });
});
