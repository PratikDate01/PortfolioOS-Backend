/**
 * GitHub Stats Sync Service
 * Fetches and caches GitHub profile and repository data.
 */

import { cacheService } from './cacheService';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  fork?: boolean;
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
    // New fields for Section 1
    totalStars: number;
    totalForks: number;
    contributionStatus: string;
    lastActivity: string;
  };
  topRepos: {
    name: string;
    description: string | null;
    url: string;
    stars: number;
    forks: number;
    language: string | null;
    topics: string[];
    updatedAt: string; // New field for Section 5
  }[];
  languages: { name: string; percentage: number }[];
  recentActivity: GitHubActivity[];
  scores?: {
    developerProfile: number;
    activity: number;
    contribution: number;
    techStack: string[];
    // New fields for Section 2, 4, 7, 8
    repositoryQualityScore: number;
    openSourceScore: number;
    githubHealthScore: number;
    githubHealthLevel: string;
    developerType: string;
    primaryFocus: string;
    activityLevel: string;
    recruiterSummary: string;
  };
  lastUpdated: string;
}

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
    .slice(0, 10) // Limit to 10 most recent events for recruiter activity feed
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

/**
 * Local heuristic classifier to determine developer profile details if Gemini is unavailable
 */
function getLocalProfileSummary(
  username: string,
  languages: { name: string; percentage: number }[],
  topRepos: any[],
  totalStars: number,
  activityLevel: string
): {
  developerType: string;
  primaryFocus: string;
  recruiterSummary: string;
  githubHealthScore: number;
} {
  let developerType = 'Full Stack Developer';
  let primaryFocus = 'Web Development';

  const hasFrontend = languages.some(l => ['TypeScript', 'JavaScript', 'HTML', 'CSS'].includes(l.name));
  const hasBackend = languages.some(l => ['Python', 'Java', 'Go', 'Rust', 'Ruby', 'C#', 'PHP', 'C++'].includes(l.name));
  const frontendPercent = languages.filter(l => ['TypeScript', 'JavaScript', 'HTML', 'CSS'].includes(l.name)).reduce((a, b) => a + b.percentage, 0);

  const topics = new Set<string>();
  topRepos.forEach(r => {
    if (r.topics) r.topics.forEach((t: string) => topics.add(t.toLowerCase()));
  });

  if (topics.has('ai') || topics.has('ml') || topics.has('machine-learning') || topics.has('data-science') || topics.has('deep-learning')) {
    developerType = 'AI/ML Engineer';
    primaryFocus = 'Machine Learning & Data';
  } else if (topics.has('devops') || topics.has('aws') || topics.has('kubernetes') || topics.has('docker')) {
    developerType = 'DevOps Engineer';
    primaryFocus = 'Cloud Infrastructure';
  } else if (hasFrontend && hasBackend) {
    developerType = 'Full Stack Developer';
    primaryFocus = 'Web Applications';
  } else if (hasFrontend && frontendPercent > 70) {
    developerType = 'Frontend Engineer';
    primaryFocus = 'User Interfaces & Web Apps';
  } else if (hasBackend) {
    developerType = 'Backend Engineer';
    primaryFocus = 'Systems & REST APIs';
  }

  const topLangs = languages.slice(0, 3).map(l => l.name).join(', ');
  let summary = `This candidate demonstrates solid technical proficiency, utilizing a stack led by ${topLangs || 'modern technologies'}. `;
  if (topRepos.length > 0) {
    summary += `Their featured project, ${topRepos[0].name}, showcases practical implementation of ${topRepos[0].language || 'coding paradigms'}. `;
  }
  if (totalStars > 5) {
    summary += `With ${totalStars} stars across their projects, their work demonstrates positive developer community validation. `;
  }
  summary += `Their overall public repository metrics indicate a ${activityLevel.toLowerCase()} level of coding consistency and focus.`;

  // Compute baseline health score
  let healthScore = 40; // base
  if (languages.length > 0) healthScore += 10;
  if (languages.length > 2) healthScore += 5;
  if (topRepos.length > 0) healthScore += 10;
  if (topRepos.length > 3) healthScore += 10;

  // descriptions ratio
  const withDesc = topRepos.filter(r => !!r.description).length;
  if (topRepos.length > 0) {
    healthScore += Math.round((withDesc / topRepos.length) * 15);
  }

  // activity
  if (activityLevel === 'High') healthScore += 10;
  else if (activityLevel === 'Medium') healthScore += 5;

  return {
    developerType,
    primaryFocus,
    recruiterSummary: summary,
    githubHealthScore: Math.min(100, healthScore)
  };
}

/**
 * AI-powered recruiter insights using Gemini
 */
async function generateAIRecruiterInsights(
  username: string,
  bio: string | null,
  publicRepos: number,
  followers: number,
  languages: { name: string; percentage: number }[],
  topRepos: any[],
  recentActivity: any[]
): Promise<{
  developerType: string;
  primaryFocus: string;
  recruiterSummary: string;
  githubHealthScore: number;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a Principal Technical Recruiter and Technical Interviewer analyzing a candidate's GitHub Profile data.

GitHub Profile:
Username: ${username}
Bio: ${bio || 'None'}
Public Repos: ${publicRepos}
Followers: ${followers}

Top Repositories:
${topRepos.slice(0, 6).map(r => `- ${r.name}: ${r.description || 'No description'}. Stars: ${r.stars}, Forks: ${r.forks}, Language: ${r.language}, Topics: ${r.topics?.join(', ') || 'None'}`).join('\n')}

Languages Distribution:
${languages.map(l => `${l.name}: ${l.percentage}%`).join(', ')}

Recent Activity:
${recentActivity.map(a => `- ${a.message} in ${a.repoName} (${a.createdAt})`).join('\n')}

Based on this real data, generate:
1. "developerType": A precise job title (e.g. "Full Stack Developer", "Frontend Engineer", "Backend Engineer", "AI/ML Engineer", "Open Source Contributor").
2. "primaryFocus": A brief area of expertise (e.g. "Web Development", "Data Science", "Mobile Apps", etc.).
3. "recruiterSummary": A professional, recruitment-focused summary paragraph (2-3 sentences max) highlighting their core strengths, languages, and activity level. Make sure it sounds objective, technical, and impressive to hiring managers.
4. "githubHealthScore": A score from 0 to 100 evaluating documentation, code organization, activity, profile completeness, and repo quality.

Return ONLY clean JSON code. No markdown boxes, no backticks, no comments. Use this structure:
{
  "developerType": "...",
  "primaryFocus": "...",
  "recruiterSummary": "...",
  "githubHealthScore": 92
}`;

    const result = await model.generateContent(prompt);
    let jsonText = result.response.text().trim();

    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(jsonText);
    if (
      data.developerType &&
      data.primaryFocus &&
      data.recruiterSummary &&
      typeof data.githubHealthScore === 'number'
    ) {
      return data;
    }
    return null;
  } catch (err) {
    console.error('Failed to generate AI insights for GitHub profile:', err);
    return null;
  }
}

export async function fetchGitHubStats(githubUsername?: string): Promise<GitHubStats> {
  const username = (githubUsername || process.env.GITHUB_USERNAME || 'PratikDate01').trim();
  const cacheKey = `github_stats:${username.toLowerCase()}`;

  // Return cached if still valid
  try {
    const cached = await cacheService.get<GitHubStats>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (err) {
    console.error(`Failed to get cache for ${username}:`, err);
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
        updatedAt: repo.updated_at,
      }));

    // Calculate Developer Profile Score (completeness)
    let profileScore = 0;
    if (profileData.bio) profileScore += 25;
    if (profileData.blog) profileScore += 25;
    if (profileData.company) profileScore += 25;
    if (profileData.location) profileScore += 25;

    // Calculate Activity Score (0-100)
    let activityScore = 0;
    if (Array.isArray(eventsData)) {
      for (const event of eventsData) {
        if (event.type === 'PushEvent') activityScore += 10;
        else if (event.type === 'PullRequestEvent') activityScore += 15;
        else if (event.type === 'IssuesEvent') activityScore += 10;
        else activityScore += 5;
      }
    }
    activityScore = Math.min(100, activityScore);

    // Calculate Contribution Score (0-100)
    let contributionScore = 0;
    if (Array.isArray(eventsData)) {
      for (const event of eventsData) {
        if (event.type === 'PushEvent') {
          const commitsCount = event.payload?.commits?.length || 0;
          contributionScore += commitsCount * 15;
        }
      }
    }
    const totalStars = reposData.reduce((acc, repo) => acc + (repo.stargazers_count || 0), 0);
    const totalForks = reposData.reduce((acc, repo) => acc + (repo.forks_count || 0), 0);
    contributionScore += totalStars * 5 + totalForks * 5;
    contributionScore = Math.min(100, contributionScore);

    // Tech Stack Detection
    const techStackSet = new Set<string>();
    for (const repo of reposData) {
      if (repo.language) techStackSet.add(repo.language);
      if (Array.isArray(repo.topics)) {
        for (const topic of repo.topics) {
          techStackSet.add(topic);
        }
      }
    }
    const techStack = Array.from(techStackSet).slice(0, 15);

    // Calculate Repository Quality Score (0-100)
    const withDesc = topRepos.filter(r => !!r.description).length;
    const descRatioScore = topRepos.length > 0 ? (withDesc / topRepos.length) * 40 : 0;
    const starRatioScore = Math.min(20, totalStars * 2);
    const forkRatioScore = Math.min(20, totalForks * 4);
    const topicsRatioScore = topRepos.some(r => r.topics.length > 0) ? 20 : 0;
    const repositoryQualityScore = Math.round(descRatioScore + starRatioScore + forkRatioScore + topicsRatioScore);

    // Calculate Open Source Score (0-100)
    let openSourceScore = 30; // base score
    if (Array.isArray(eventsData)) {
      const hasPRs = eventsData.some(e => e.type === 'PullRequestEvent');
      const hasIssues = eventsData.some(e => e.type === 'IssuesEvent');
      const hasForks = eventsData.some(e => e.type === 'ForkEvent');
      if (hasPRs) openSourceScore += 30;
      if (hasIssues) openSourceScore += 20;
      if (hasForks) openSourceScore += 10;
    }
    const ownedForks = reposData.filter(r => r.fork === true).length;
    openSourceScore += Math.min(10, ownedForks * 5);
    openSourceScore = Math.min(100, openSourceScore);

    // Activity Levels
    let activityLevel = 'Low';
    let contributionStatus = 'Quiet';
    if (activityScore >= 75) {
      activityLevel = 'High';
      contributionStatus = 'Very Active';
    } else if (activityScore >= 40) {
      activityLevel = 'Medium';
      contributionStatus = 'Active';
    } else if (activityScore >= 15) {
      activityLevel = 'Medium';
      contributionStatus = 'Moderate';
    }

    // Determine Last Activity Date
    let lastActivity = new Date().toISOString();
    const parsedEvents = parseGitHubEvents(eventsData);
    if (parsedEvents.length > 0) {
      lastActivity = parsedEvents[0].createdAt;
    } else if (reposData.length > 0) {
      const sortedByUpdate = [...reposData].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      lastActivity = sortedByUpdate[0].updated_at;
    }

    const languages = computeLanguages(reposData);

    // Baseline Heuristic Insights
    const heuristicInsights = getLocalProfileSummary(
      username,
      languages,
      topRepos,
      totalStars,
      activityLevel
    );

    // Try AI insights from Gemini
    const aiInsights = await generateAIRecruiterInsights(
      username,
      profileData.bio,
      profileData.public_repos,
      profileData.followers,
      languages,
      topRepos,
      parsedEvents
    );

    const devType = aiInsights?.developerType || heuristicInsights.developerType;
    const focus = aiInsights?.primaryFocus || heuristicInsights.primaryFocus;
    const summary = aiInsights?.recruiterSummary || heuristicInsights.recruiterSummary;
    
    // Overall Health Score calculation (0-100)
    let githubHealthScore = aiInsights?.githubHealthScore || heuristicInsights.githubHealthScore;
    // Cross-validate that health score includes elements of profile completeness, repository quality, and activity
    if (!aiInsights) {
      const completenessWeight = profileScore * 0.20;
      const activityWeight = activityScore * 0.25;
      const contributionWeight = contributionScore * 0.20;
      const qualityWeight = repositoryQualityScore * 0.20;
      const langDiversity = Math.min(100, languages.length * 20) * 0.15;
      githubHealthScore = Math.round(completenessWeight + activityWeight + contributionWeight + qualityWeight + langDiversity);
    }
    githubHealthScore = Math.max(30, Math.min(100, githubHealthScore));

    let githubHealthLevel = 'Developing';
    if (githubHealthScore >= 85) githubHealthLevel = 'Excellent';
    else if (githubHealthScore >= 70) githubHealthLevel = 'Good';
    else if (githubHealthScore >= 50) githubHealthLevel = 'Average';

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
        // Added Section 1 fields
        totalStars,
        totalForks,
        contributionStatus,
        lastActivity,
      },
      topRepos,
      languages,
      recentActivity: parsedEvents,
      scores: {
        developerProfile: profileScore,
        activity: activityScore,
        contribution: contributionScore,
        techStack,
        // Added new health, classification, and summary fields
        repositoryQualityScore,
        openSourceScore,
        githubHealthScore,
        githubHealthLevel,
        developerType: devType,
        primaryFocus: focus,
        activityLevel,
        recruiterSummary: summary,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Update cache (2 hours TTL)
    try {
      await cacheService.set(cacheKey, stats, 7200);
    } catch (err) {
      console.error(`Failed to cache stats for ${username}:`, err);
    }

    return stats;
  } catch (error) {
    console.error(`Failed to fetch GitHub stats for ${username}:`, error);

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
        recruiterSummary: 'GitHub connection could not be established or stats are currently loading.',
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
