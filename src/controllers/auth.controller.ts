import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';
import { createDefaultSubscription } from '../models/subscription.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';
const JWT_EXPIRES_IN = '1d'; // Using 1 day for easier local testing

const generateToken = (payload: { id: string; role: string; email: string; username: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
    xp: user.xp,
    level: user.level,
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
      xp: 0,
      level: 1,
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
      xp: 0,
      level: 1,
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
        xp: 0,
        level: 1,
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

    res.redirect(`${frontendUrl}/login?token=${token}`);
  } catch (error) {
    console.error(`${provider} OAuth error:`, error);
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
}
