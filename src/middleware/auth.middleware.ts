import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SaaSRole } from '@portfolio-os/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';

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
 * Role-based access control middleware.
 * Restricts access to users with one of the specified roles.
 */
export const restrictTo = (...roles: (SaaSRole | 'owner' | 'member')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRole = req.user.role;
    const mappedUserRoles: string[] = [userRole];

    if (userRole === 'superadmin') {
      mappedUserRoles.push('owner');
    }
    if (userRole === 'user') {
      mappedUserRoles.push('owner', 'member');
    }

    const hasPermission = roles.some((role) => mappedUserRoles.includes(role));

    if (!hasPermission) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }

    next();
  };
};
