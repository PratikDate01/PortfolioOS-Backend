import { Request, Response } from 'express';
import { fetchGitHubStats } from '../services/githubSync';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';

export const getGitHubStats = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    let githubUsername: string | undefined = undefined;

    if (username) {
      const parsedUsername = String(username).trim();
      const tenantUsername = parsedUsername.toLowerCase();
      
      // 1. Try to find user by tenant username
      const user = await UserModel.findOne({ username: tenantUsername });
      if (user && user.githubUsername) {
        githubUsername = user.githubUsername.trim();
      } else {
        // 2. Try to find portfolio by tenant username
        const portfolio = await PortfolioModel.findOne({ username: tenantUsername });
        if (portfolio && portfolio.githubUsername) {
          githubUsername = portfolio.githubUsername.trim();
        }
      }

      // 3. If not found, check if it matches any user/portfolio githubUsername in the DB
      if (!githubUsername) {
        const userByGithub = await UserModel.findOne({
          githubUsername: { $regex: new RegExp(`^${parsedUsername}$`, 'i') }
        });
        if (userByGithub && userByGithub.githubUsername) {
          githubUsername = userByGithub.githubUsername.trim();
        } else {
          const portfolioByGithub = await PortfolioModel.findOne({
            githubUsername: { $regex: new RegExp(`^${parsedUsername}$`, 'i') }
          });
          if (portfolioByGithub && portfolioByGithub.githubUsername) {
            githubUsername = portfolioByGithub.githubUsername.trim();
          }
        }
      }

      // 4. If still not found, treat the parameter itself as the GitHub username
      if (!githubUsername && parsedUsername) {
        githubUsername = parsedUsername;
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
              totalStars: 0,
              totalForks: 0,
              contributionStatus: 'Quiet',
              lastActivity: new Date().toISOString(),
            },
            topRepos: [],
            languages: [],
            recentActivity: [],
            scores: {
              developerProfile: 0,
              activity: 0,
              contribution: 0,
              techStack: [],
              repositoryQualityScore: 0,
              openSourceScore: 0,
              githubHealthScore: 0,
              githubHealthLevel: 'Developing',
              developerType: 'N/A',
              primaryFocus: 'N/A',
              activityLevel: 'Low',
              recruiterSummary: 'GitHub account is not connected.',
            },
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

