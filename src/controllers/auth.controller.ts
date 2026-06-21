import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';
import { createDefaultSubscription } from '../models/subscription.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes access token expiry
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days refresh token expiry

const generateToken = (payload: { id: string; role: string; email: string; username: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

const generateRefreshToken = (payload: { id: string }) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const setRefreshTokenCookie = (res: Response, token: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Generate a URL-safe username from a display name.
 */
function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 30);
}

/**
 * Ensure username uniqueness by appending a numeric suffix.
 */
async function ensureUniqueUsername(baseUsername: string): Promise<string> {
  let candidate = baseUsername;
  let suffix = 1;

  while (true) {
    const existing = await UserModel.findOne({ username: candidate }).lean();
    if (!existing) return candidate;
    candidate = `${baseUsername}-${suffix}`;
    suffix++;
    if (suffix > 100) {
      // Fallback to random suffix
      candidate = `${baseUsername}-${Math.random().toString(36).substring(2, 6)}`;
      return candidate;
    }
  }
}

/**
 * Create a Portfolio and Subscription for a newly registered user.
 */
async function provisionUserResources(userId: mongoose.Types.ObjectId, username: string, bio?: string) {
  // Create portfolio
  await PortfolioModel.create({
    ownerId: userId,
    username,
    slug: username,
    bio,
    theme: 'portfolio-os',
    visibility: 'public',
    analyticsSettings: { enabled: true },
  });

  // Create default (free) subscription
  const subscription = createDefaultSubscription(userId);
  await subscription.save();
}

/**
 * Sanitize user data for API response (strip sensitive fields).
 */
function sanitizeUser(user: any) {
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    profileImage: user.profileImage,
    coverImage: user.coverImage,
    socialLinks: user.socialLinks,
    githubUsername: user.githubUsername,
    subscriptionTier: user.subscriptionTier,
    authProvider: user.authProvider,
    badgeIds: user.badgeIds,
    isVerified: user.isVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, username: requestedUsername } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    // Generate or validate username
    let username: string;
    if (requestedUsername) {
      // User-provided username
      const sanitized = requestedUsername.toLowerCase().trim().replace(/[^a-z0-9-]/g, '').substring(0, 30);
      if (sanitized.length < 3) {
        res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, hyphens only)' });
        return;
      }
      const usernameExists = await UserModel.findOne({ username: sanitized });
      if (usernameExists) {
        res.status(400).json({ error: 'Username is already taken' });
        return;
      }
      username = sanitized;
    } else {
      // Auto-generate from name
      const base = generateUsername(name);
      username = await ensureUniqueUsername(base || 'user');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // First user is superadmin, subsequent are regular users
    const userCount = await UserModel.countDocuments();
    const role = userCount === 0 ? 'superadmin' : 'user';

    const user = new UserModel({
      username,
      name,
      email,
      passwordHash,
      role,
      authProvider: 'local',
      isVerified: false,
      subscriptionTier: 'free',
    });

    await user.save();

    // Provision portfolio and subscription
    await provisionUserResources(user._id, username, undefined);

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username,
    });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username,
    });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      res.status(401).json({ error: 'Not authorized, invalid token structure' });
      return;
    }

    const user = await UserModel.findById(req.user.id).select('-passwordHash -refreshTokenHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ data: user });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching user details' });
  }
};

export const guestLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const guestUsername = `guest-${Date.now()}-${randomSuffix}`;
    const email = `${guestUsername}@portfolio-guest.local`;

    // Create a real Guest User in MongoDB so their progress, profile, and bookmarks are persistent and functional
    const guestUser = new UserModel({
      username: guestUsername,
      name: 'Guest User',
      email,
      authProvider: 'local',
      role: 'guest',
      subscriptionTier: 'free',
      isVerified: false
    });

    await guestUser.save();

    // Provision minimal portfolio for guest
    await provisionUserResources(guestUser._id, guestUsername, undefined);

    const token = generateToken({
      id: guestUser._id.toString(),
      role: 'guest',
      email: guestUser.email,
      username: guestUser.username,
    });
    const refreshToken = generateRefreshToken({ id: guestUser._id.toString() });
    guestUser.refreshTokenHash = hashToken(refreshToken);
    await guestUser.save();

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      data: {
        token,
        user: sanitizeUser(guestUser),
      },
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ error: 'Server error during guest authentication' });
  }
};

/**
 * Handle OAuth callback — find or create user, provision resources, redirect.
 * Used by both Google and GitHub OAuth routes.
 */
export async function handleOAuthCallback(
  provider: 'google' | 'github',
  profile: { name: string; email: string; providerId: string; avatarUrl?: string },
  res: Response
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  try {
    // Try to find user by provider + providerId first
    let user = await UserModel.findOne({ authProvider: provider, providerId: profile.providerId });

    if (!user) {
      // Try by email (could have registered via local auth first)
      user = await UserModel.findOne({ email: profile.email });
      if (user) {
        // Link the OAuth provider to existing account
        user.authProvider = provider;
        user.providerId = profile.providerId;
        if (profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
        await user.save();
      }
    }

    if (!user) {
      // New user — create account
      const base = generateUsername(profile.name);
      const username = await ensureUniqueUsername(base || 'user');

      user = new UserModel({
        username,
        name: profile.name,
        email: profile.email,
        authProvider: provider,
        providerId: profile.providerId,
        avatarUrl: profile.avatarUrl,
        role: 'user',
        subscriptionTier: 'free',
        isVerified: true, // OAuth emails are verified by the provider
      });
      await user.save();

      // Provision portfolio and subscription
      await provisionUserResources(user._id, username, undefined);
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username,
    });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    res.redirect(`${frontendUrl}/login?token=${token}`);
  } catch (error) {
    console.error(`${provider} OAuth error:`, error);
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
}

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = (req as any).cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token not found in cookies' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Verify token hash
    const tokenHash = hashToken(refreshToken);
    if (!user.refreshTokenHash || user.refreshTokenHash !== tokenHash) {
      // Refresh token reuse/theft detected! Clear session in DB.
      user.refreshTokenHash = undefined;
      await user.save();
      const isProd = process.env.NODE_ENV === 'production';
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
      });
      res.status(401).json({ error: 'Token reuse detected. Session terminated.' });
      return;
    }

    // Generate new keys (Access + Refresh token rotation)
    const newAccessToken = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username,
    });
    const newRefreshToken = generateRefreshToken({ id: user._id.toString() });

    // Save hash of new refresh token
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    // Set cookie
    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      data: {
        token: newAccessToken,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Server error during token refresh' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const user = await UserModel.findById(userId);
      if (user) {
        user.refreshTokenHash = undefined;
        await user.save();
      }
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};
