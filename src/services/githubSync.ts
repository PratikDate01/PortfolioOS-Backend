/**
 * GitHub Stats Sync Service
 * Fetches and caches GitHub profile and repository data.
 */

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
}

interface GitHubProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
  following: number;
  bio: string | null;
}

export interface GitHubStats {
  profile: {
    username: string;
    name: string;
    avatarUrl: string;
    profileUrl: string;
    publicRepos: number;
    followers: number;
    bio: string | null;
  };
  topRepos: {
    name: string;
    description: string | null;
    url: string;
    stars: number;
    forks: number;
    language: string | null;
    topics: string[];
  }[];
  languages: { name: string; percentage: number }[];
  lastUpdated: string;
}

// In-memory cache
let cachedStats: GitHubStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

async function githubFetch(endpoint: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'PortfolioOS/1.0',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function computeLanguages(repos: GitHubRepo[]): { name: string; percentage: number }[] {
  const langCount: Record<string, number> = {};
  let total = 0;

  for (const repo of repos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
      total++;
    }
  }

  return Object.entries(langCount)
    .map(([name, count]) => ({ name, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8);
}

export async function fetchGitHubStats(): Promise<GitHubStats> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStats;
  }

  const username = process.env.GITHUB_USERNAME || 'PratikDate01';

  try {
    const [profileData, reposData] = await Promise.all([
      githubFetch(`/users/${username}`) as Promise<GitHubProfile>,
      githubFetch(`/users/${username}/repos?sort=updated&per_page=20&type=owner`) as Promise<GitHubRepo[]>,
    ]);

    const topRepos = reposData
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        topics: repo.topics || [],
      }));

    const stats: GitHubStats = {
      profile: {
        username: profileData.login,
        name: profileData.name || profileData.login,
        avatarUrl: profileData.avatar_url,
        profileUrl: profileData.html_url,
        publicRepos: profileData.public_repos,
        followers: profileData.followers,
        bio: profileData.bio,
      },
      topRepos,
      languages: computeLanguages(reposData),
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;

    return stats;
  } catch (error) {
    console.error('Failed to fetch GitHub stats:', error);

    // Return stale cache if available
    if (cachedStats) {
      return cachedStats;
    }

    // Return empty fallback
    return {
      profile: {
        username,
        name: 'Pratik Date',
        avatarUrl: '',
        profileUrl: `https://github.com/${username}`,
        publicRepos: 0,
        followers: 0,
        bio: null,
      },
      topRepos: [],
      languages: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
