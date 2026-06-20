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
  company: string | null;
  location: string | null;
  blog: string | null;
  created_at: string;
  public_gists: number;
}

export interface GitHubActivity {
  id: string;
  type: string;
  repoName: string;
  repoUrl: string;
  message: string;
  createdAt: string;
}

export interface GitHubStats {
  profile: {
    username: string;
    name: string;
    avatarUrl: string;
    profileUrl: string;
    publicRepos: number;
    followers: number;
    following: number;
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    createdAt: string;
    publicGists: number;
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
  recentActivity: GitHubActivity[];
  lastUpdated: string;
}

// In-memory cache map to support multi-tenancy
interface CacheEntry {
  stats: GitHubStats;
  timestamp: number;
}
const cacheMap = new Map<string, CacheEntry>();
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

function parseGitHubEvents(events: any[]): GitHubActivity[] {
  if (!Array.isArray(events)) return [];

  return events
    .slice(0, 5) // Limit to 5 most recent events
    .map((event) => {
      let message = '';
      const repoName = event.repo?.name || '';
      const repoUrl = `https://github.com/${repoName}`;

      switch (event.type) {
        case 'PushEvent': {
          const ref = event.payload?.ref ? event.payload.ref.replace('refs/heads/', '') : 'main';
          const commitsCount = event.payload?.commits?.length || 0;
          const firstCommitMsg = event.payload?.commits?.[0]?.message || '';
          const commitText = firstCommitMsg ? `: "${firstCommitMsg.split('\n')[0]}"` : '';
          message = `Pushed ${commitsCount} commit${commitsCount !== 1 ? 's' : ''} to \`${ref}\`${commitText}`;
          break;
        }
        case 'IssuesEvent': {
          const action = event.payload?.action || 'opened';
          const issueNumber = event.payload?.issue?.number || '';
          const issueTitle = event.payload?.issue?.title || '';
          message = `${action.charAt(0).toUpperCase() + action.slice(1)} issue #${issueNumber}: "${issueTitle}"`;
          break;
        }
        case 'PullRequestEvent': {
          const action = event.payload?.action || 'opened';
          const prNumber = event.payload?.pull_request?.number || '';
          const prTitle = event.payload?.pull_request?.title || '';
          message = `${action.charAt(0).toUpperCase() + action.slice(1)} pull request #${prNumber}: "${prTitle}"`;
          break;
        }
        case 'WatchEvent': {
          message = `Starred repository`;
          break;
        }
        case 'CreateEvent': {
          const refType = event.payload?.ref_type || 'repository';
          const refName = event.payload?.ref ? ` \`${event.payload.ref}\`` : '';
          message = `Created ${refType}${refName}`;
          break;
        }
        case 'ForkEvent': {
          const forkedRepo = event.payload?.forkee?.full_name || '';
          message = `Forked to \`${forkedRepo}\``;
          break;
        }
        case 'ReleaseEvent': {
          const releaseName = event.payload?.release?.name || event.payload?.release?.tag_name || 'release';
          message = `Published release "${releaseName}"`;
          break;
        }
        default: {
          const cleanType = event.type ? event.type.replace('Event', '') : 'Activity';
          message = `Performed ${cleanType} action`;
          break;
        }
      }

      return {
        id: event.id || Math.random().toString(),
        type: event.type || 'UnknownEvent',
        repoName,
        repoUrl,
        message,
        createdAt: event.created_at || new Date().toISOString(),
      };
    });
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

export async function fetchGitHubStats(githubUsername?: string): Promise<GitHubStats> {
  const username = (githubUsername || process.env.GITHUB_USERNAME || 'PratikDate01').trim();
  const now = Date.now();

  // Return cached if still valid
  const cached = cacheMap.get(username.toLowerCase());
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.stats;
  }

  try {
    const [profileData, reposData, eventsData] = await Promise.all([
      githubFetch(`/users/${username}`) as Promise<GitHubProfile>,
      githubFetch(`/users/${username}/repos?sort=updated&per_page=20&type=owner`) as Promise<GitHubRepo[]>,
      githubFetch(`/users/${username}/events/public`).catch((err) => {
        console.warn(`Failed to fetch GitHub events for ${username}:`, err);
        return [];
      }) as Promise<any[]>,
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
        following: profileData.following || 0,
        bio: profileData.bio,
        company: profileData.company,
        location: profileData.location,
        blog: profileData.blog,
        createdAt: profileData.created_at,
        publicGists: profileData.public_gists || 0,
      },
      topRepos,
      languages: computeLanguages(reposData),
      recentActivity: parseGitHubEvents(eventsData),
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    cacheMap.set(username.toLowerCase(), { stats, timestamp: now });

    return stats;
  } catch (error) {
    console.error(`Failed to fetch GitHub stats for ${username}:`, error);

    // Return stale cache if available
    if (cached) {
      return cached.stats;
    }

    // Return empty fallback
    return {
      profile: {
        username,
        name: username,
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
    };
  }
}

