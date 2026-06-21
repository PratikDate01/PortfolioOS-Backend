import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SaaSRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: SaaSRole;
    email: string;
    username: string;
  };
}

/**
 * Protect middleware — verifies JWT and attaches user payload to request.
 */
export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authorized, no token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: SaaSRole;
      email: string;
      username?: string;
    };

    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username || '',
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token invalid or expired' });
  }
};

/**
 * Optional protect — same as protect but doesn't fail if no token is provided.
 * Useful for public endpoints that return extra data for authenticated users.
 */
export const optionalProtect = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: SaaSRole;
      email: string;
      username?: string;
    };

    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username || '',
    };

    next();
  } catch {
    // Token invalid — proceed without user context
    next();
  }
};

/**
 * Custom cookie parser middleware to populate req.cookies.
 */
export const cookieParser = (req: Request, res: Response, next: NextFunction): void => {
  const cookieHeader = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length === 2) {
        cookies[parts[0].trim()] = parts[1].trim();
      }
    });
  }
  (req as any).cookies = cookies;
  next();
};

/**
 * Role-based access control middleware.
 * Restricts access to users with one of the specified roles.
 * System-wide superadmin bypasses all checks.
 */
export const restrictTo = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRole = req.user.role;

    // Superadmin bypasses all role restrictions
    if (userRole === 'superadmin') {
      next();
      return;
    }

    let hasPermission = roles.includes(userRole);

    // Hierarchical expansions
    if (roles.includes('user') && userRole === 'admin') {
      hasPermission = true;
    }
    if (roles.includes('member') && (userRole === 'user' || userRole === 'admin')) {
      hasPermission = true;
    }
    if (roles.includes('owner') && userRole === 'admin') {
      hasPermission = true;
    }

    if (!hasPermission) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }

    next();
  };
};
