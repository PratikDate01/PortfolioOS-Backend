import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'owner' | 'admin' | 'member' | 'guest';
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Not authorized, token required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: 'owner' | 'admin' | 'member' | 'guest';
      email: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};

export const restrictTo = (...roles: ('owner' | 'admin' | 'member' | 'guest')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authorized, user credentials missing' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Forbidden, required role not met` });
      return;
    }

    next();
  };
};

export const optionalProtect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        role: 'owner' | 'admin' | 'member' | 'guest';
        email: string;
      };
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Fail silently for optional auth, just continue as unauthenticated
    next();
  }
};
