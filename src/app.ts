import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { cookieParser } from './middleware/auth.middleware';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/projects.routes';
import experienceRoutes from './routes/experience.routes';
import skillRoutes from './routes/skills.routes';
import messageRoutes from './routes/messages.routes';
import blogRoutes from './routes/blog.routes';
import certificationRoutes from './routes/certifications.routes';
import testimonialRoutes from './routes/testimonials.routes';
import adminRoutes from './routes/admin.routes';
import githubRoutes from './routes/github.routes';
import aiRoutes from './routes/ai.routes';
import analyticsRoutes from './routes/analytics.routes';
import usersRoutes from './routes/users.routes';
import badgesRoutes from './routes/badges.routes';
import uploadRoutes from './routes/upload.routes';
import resumeRoutes from './routes/resume.routes';
import portfolioRoutes from './routes/portfolio.routes';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cookieParser);

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// API Routes setup versioned at /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/experience', experienceRoutes);
app.use('/api/v1/skills', skillRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/blog', blogRoutes);
app.use('/api/v1/certifications', certificationRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/github', githubRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/badges', badgesRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/resume', resumeRoutes);
app.use('/api/v1/portfolios', portfolioRoutes);

// 404 Route handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error details: ${err.stack}`);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
