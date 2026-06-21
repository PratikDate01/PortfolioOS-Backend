import { Request, Response } from 'express';
import { PortfolioModel } from '../models/portfolio.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { cacheService } from '../services/cacheService';

/**
 * Retrieve public portfolio details by username (cached)
 */
export const getPortfolioByUsername = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    const cacheKey = `portfolio:${username.toLowerCase().trim()}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.status(200).json({ data: cached });
      return;
    }
    
    const portfolio = await PortfolioModel.findOne({ 
      username: username.toLowerCase().trim() 
    }).populate('ownerId', 'name email avatarUrl bio socialLinks githubUsername');

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    // Hide details if private and visitor is not the owner
    if (portfolio.visibility === 'private') {
      res.status(403).json({ error: 'This portfolio is set to private' });
      return;
    }

    // Cache resolved public portfolio for 5 minutes (300 seconds)
    await cacheService.set(cacheKey, portfolio, 300);

    res.status(200).json({ data: portfolio });
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving portfolio' });
  }
};

/**
 * Update the logged-in user's portfolio settings
 */
export const updateMyPortfolio = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const updateData = req.body;
    
    // Prevent updating ownerId and username directly through this endpoint
    delete updateData.ownerId;
    delete updateData.username;

    const portfolio = await PortfolioModel.findOneAndUpdate(
      { ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found for this user' });
      return;
    }

    // Invalidate cache
    await cacheService.del(`portfolio:${portfolio.username.toLowerCase()}`);

    res.status(200).json({ data: portfolio });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating portfolio settings' });
  }
};
