import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { UploadRecordModel } from '../models/upload.model';
import * as cloudinaryService from '../services/cloudinaryService';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';

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
      expect(response.body).toHaveProperty('error', 'Not authorized, token required');
    });

    it('should reject upload calls for non-owner and non-admin users', async () => {
      const guestToken = jwt.sign({ id: 'test-guest-id', role: 'guest', email: 'guest@portfolio-os.local' }, JWT_SECRET);
      
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .attach('file', Buffer.from('small-image-content'), 'profile.png');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden, required role not met');
    });
  });

  describe('Profile Image Upload Validation (5MB Limit)', () => {
    it('should successfully upload a valid small PNG image', async () => {
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('small-image-content'), 'profile.png');

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
      // Create a 6MB dummy buffer
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      
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
      const response = await request(app)
        .post('/api/v1/upload/project-video')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('small-video-content'), 'demo.mp4');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('resourceType', 'video');
      expect(cloudinaryService.uploadVideo).toHaveBeenCalledTimes(1);
    });

    it('should reject a video that exceeds the 50MB size limit', async () => {
      // Create a 51MB dummy buffer
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
      
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
      // Create an 11MB dummy buffer
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      
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
