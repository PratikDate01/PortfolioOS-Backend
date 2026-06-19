import { Request, Response } from 'express';
import { fetchGitHubStats } from '../services/githubSync';

export const getGitHubStats = async (req: Request, res: Response) => {
  try {
    const stats = await fetchGitHubStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('GitHub stats error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub stats' });
  }
};
