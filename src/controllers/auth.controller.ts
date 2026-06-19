import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';
const JWT_EXPIRES_IN = '1d'; // Using 1 day for easier local testing

const generateToken = (payload: { id: string; role: string; email: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // First user is owner, subsequent are member
    const userCount = await UserModel.countDocuments();
    const role = userCount === 0 ? 'owner' : 'member';

    const user = new UserModel({
      name,
      email,
      passwordHash,
      role,
      authProvider: 'local',
      isVerified: false,
      xp: 0,
      level: 1,
    });

    await user.save();

    const token = generateToken({ id: user._id.toString(), role: user.role, email: user.email });

    res.status(201).json({
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          xp: user.xp,
          level: user.level,
        },
      },
    });
  } catch (error) {
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

    const token = generateToken({ id: user._id.toString(), role: user.role, email: user.email });

    res.status(200).json({
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          xp: user.xp,
          level: user.level,
        },
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
    const email = `guest_${Date.now()}_${randomSuffix}@portfolio-guest.local`;

    // Create a real Guest User in MongoDB so their progress, profile, and bookmarks are persistent and functional
    const guestUser = new UserModel({
      name: 'Guest User',
      email,
      authProvider: 'guest',
      role: 'guest',
      xp: 0,
      level: 1,
      isVerified: false
    });

    await guestUser.save();

    const token = generateToken({
      id: guestUser._id.toString(),
      role: 'guest',
      email: guestUser.email,
    });

    res.status(200).json({
      data: {
        token,
        user: {
          id: guestUser._id.toString(),
          name: guestUser.name,
          email: guestUser.email,
          role: 'guest',
          xp: guestUser.xp,
          level: guestUser.level,
        },
      },
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ error: 'Server error during guest authentication' });
  }
};
