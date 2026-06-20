import { Request, Response } from 'express';
import { fetchGitHubStats } from '../services/githubSync';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';

export const getGitHubStats = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    let githubUsername: string | undefined = undefined;

    if (username) {
      const tenantUsername = String(username).toLowerCase().trim();
      const user = await UserModel.findOne({ username: tenantUsername });
      if (user && user.githubUsername) {
        githubUsername = user.githubUsername.trim();
      } else {
        const portfolio = await PortfolioModel.findOne({ username: tenantUsername });
        if (portfolio && portfolio.githubUsername) {
          githubUsername = portfolio.githubUsername.trim();
        }
      }

      // If a specific tenant username was requested but they have no GitHub username,
      // return empty fallback stats for this tenant instead of falling back to default site owner.
      if (!githubUsername) {
        return res.json({
          data: {
            profile: {
              username: String(username),
              name: String(username),
              avatarUrl: '',
              profileUrl: `https://github.com/${username}`,
              publicRepos: 0,
              followers: 0,
              following: 0,
              bio: null,
              company: null,
              location: null,
              blog: null,
              createdAt: new Date().toISOString(),
              publicGists: 0,
            },
            topRepos: [],
            languages: [],
            recentActivity: [],
            lastUpdated: new Date().toISOString(),
          }
        });
      }
    } else {
      githubUsername = (process.env.GITHUB_USERNAME || 'PratikDate01').trim();
    }

    const stats = await fetchGitHubStats(githubUsername);
    res.json({ data: stats });
  } catch (error) {
    console.error('GitHub stats error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub stats' });
  }
};

