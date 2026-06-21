process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-secure-and-long-enough-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-that-is-secure-and-long-enough-32-chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { safeParseJson } from '../utils/json';
import { validateFileSignature } from '../utils/fileSignature';
import { ProjectModel } from '../models/project.model';

const JWT_SECRET = process.env.JWT_SECRET as string;

// Mock DB models used in tests
jest.mock('../models/project.model', () => {
  return {
    ProjectModel: {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0)
    }
  };
});

jest.mock('../models/user.model', () => {
  return {
    UserModel: {
      findOne: jest.fn().mockResolvedValue({ _id: 'mock-user-id', role: 'user' })
    }
  };
});

jest.mock('../models/blogPost.model', () => {
  return {
    BlogPostModel: {
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([])
    }
  };
});

jest.mock('../models/certification.model', () => {
  return {
    CertificationModel: {
      countDocuments: jest.fn().mockResolvedValue(0)
    }
  };
});

jest.mock('../models/message.model', () => {
  return {
    MessageModel: {
      countDocuments: jest.fn().mockResolvedValue(0)
    }
  };
});

jest.mock('../models/testimonial.model', () => {
  return {
    TestimonialModel: {
      countDocuments: jest.fn().mockResolvedValue(0)
    }
  };
});

describe('Security &Tenancy Gating Tests', () => {
  const superadminToken = jwt.sign({ id: 'super-admin-id', role: 'superadmin', email: 'super@portfolio-os.local' }, JWT_SECRET);
  const userToken = jwt.sign({ id: 'user-id-1', role: 'user', email: 'user@portfolio-os.local' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Security & Cookie Refresh', () => {
    it('should reject refresh token requests with no cookies', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('RBAC Privilege Gating', () => {
    it('should deny a regular user access to admin-only stats', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('permission');
    });

    it('should allow a superadmin access to admin-only stats', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${superadminToken}`);
      
      // If it passes auth middleware, it will hit DB and return mock or health check success
      expect(response.status).not.toBe(403);
    });
  });

  describe('File Upload Signatures (Spoof Prevention)', () => {
    it('should detect invalid file headers using magic-byte check', () => {
      // Create plain text buffer but call it PNG
      const textBuffer = Buffer.from('this is just some plain text and not an image');
      const signature = validateFileSignature(textBuffer);
      expect(signature.isValid).toBe(false);
    });

    it('should successfully detect valid PNG magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]);
      const signature = validateFileSignature(pngHeader);
      expect(signature.isValid).toBe(true);
      expect(signature.detectedMime).toBe('image/png');
    });

    it('should reject uploaded image that fails magic bytes check', async () => {
      const response = await request(app)
        .post('/api/v1/upload/profile')
        .set('Authorization', `Bearer ${superadminToken}`)
        .attach('file', Buffer.from('invalid-non-png-content'), 'profile.png');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('MIME type spoofing detected');
    });
  });

  describe('JSON Safe Parser Tests', () => {
    it('should parse clean JSON correctly', () => {
      const json = '{"key": "value"}';
      const result = safeParseJson(json, {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse markdown-wrapped JSON blocks', () => {
      const json = '```json\n{"key": "value"}\n```';
      const result = safeParseJson(json, {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should fall back gracefully on malformed JSON instead of crashing', () => {
      const json = '{"key": "value"'; // missing closing brace
      const fallback = { status: 'fallback' };
      const result = safeParseJson(json, fallback);
      expect(result).toEqual(fallback);
    });
  });
});
