import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';
import { ProjectModel } from '../models/project.model';
import { SkillModel } from '../models/skill.model';
import { CertificationModel } from '../models/certification.model';
import { ResumeModel } from '../models/resume.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { safeParseJson } from '../utils/json';
import { fetchGitHubStats } from '../services/githubSync';

// Predefined target roles & typical required skills for baseline checks
const ROLE_SKILLS_MAP: Record<string, string[]> = {
  frontend: ['react', 'typescript', 'javascript', 'html', 'css', 'redux', 'tailwind', 'webpack', 'nextjs', 'vue', 'angular'],
  backend: ['node', 'express', 'python', 'go', 'golang', 'java', 'sql', 'mongodb', 'postgresql', 'docker', 'redis', 'rest api', 'graphql', 'postgres', 'mysql'],
  fullstack: ['react', 'typescript', 'node', 'express', 'sql', 'mongodb', 'postgresql', 'docker', 'git', 'rest api', 'tailwind', 'javascript'],
  devops: ['docker', 'kubernetes', 'aws', 'ci/cd', 'github actions', 'terraform', 'linux', 'bash', 'jenkins', 'gcp', 'azure', 'ansible']
};

/**
 * Endpoint 1: ATS Match Score
 * Evaluates how well a user's skills match a given Job Description
 */
export const getAtsMatch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { jobDescription, customSkills } = req.body;
    const userId = req.user?.id;

    if (!jobDescription) {
      res.status(400).json({ error: 'jobDescription is required' });
      return;
    }

    // Get user skills
    let userSkills: string[] = [];
    if (customSkills && Array.isArray(customSkills)) {
      userSkills = customSkills.map(s => String(s).toLowerCase().trim());
    } else if (userId) {
      const skillsInDb = await SkillModel.find({ userId });
      userSkills = skillsInDb.map(s => s.name.toLowerCase().trim());
    }

    // Step 1: Local Keyword extraction and match score
    const jdClean = jobDescription.toLowerCase();
    const allKeywords = userSkills.filter(skill => jdClean.includes(skill));
    
    // Baseline heuristic: ratio of matched user skills to total user skills
    const baselineScore = userSkills.length > 0 
      ? Math.round((allKeywords.length / Math.max(5, userSkills.length)) * 100) 
      : 0;

    // Step 2: AI Refinement (if GEMINI_API_KEY is available)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback response if AI is not configured
      res.status(200).json({
        data: {
          score: Math.min(100, baselineScore),
          matchedSkills: allKeywords,
          missingSkills: [],
          feedback: 'Baseline keyword matching performed successfully. AI-powered semantic refinement is currently unavailable.'
        }
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an ATS (Applicant Tracking System) parser. Analyze the match between the candidate's skills and the target Job Description.
    
    Candidate Skills:
    ${userSkills.join(', ')}

    Job Description:
    ${jobDescription}

    Evaluate the candidate's fit. Provide a match score (0-100), identify key matched skills, highlight missing skills, and give short recommendations.
    Return ONLY clean JSON code. No markdown boxes. Use this structure:
    {
      "score": number,
      "matchedSkills": ["skill1", "skill2"],
      "missingSkills": ["skill3", "skill4"],
      "feedback": "detailed advice"
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const fallback = {
      score: Math.min(100, baselineScore),
      matchedSkills: allKeywords,
      missingSkills: [],
      feedback: 'Could not structure AI recommendation.'
    };

    res.json({ data: safeParseJson(text, fallback) });
  } catch (error) {
    console.error('ATS Match error:', error);
    res.status(500).json({ error: 'Server error during ATS evaluation' });
  }
};

/**
 * Endpoint 2: Resume Analysis
 * Evaluates resume text for structure, impact, clarity, action verbs
 */
export const analyzeResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { resumeText } = req.body;
    if (!resumeText || typeof resumeText !== 'string') {
      res.status(400).json({ error: 'resumeText is required' });
      return;
    }

    // Step 1: Local Heuristics
    const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(resumeText);
    const hasPhone = /(\+?\d{1,4}[\s-])?\(?\d{3}\)?[\s-]\d{3}[\s-]\d{4}/.test(resumeText);
    const hasGithub = /github\.com/i.test(resumeText);
    const hasLinkedin = /linkedin\.com/i.test(resumeText);

    // Count action verbs
    const actionVerbs = ['led', 'engineered', 'built', 'managed', 'designed', 'developed', 'created', 'spearheaded', 'optimized', 'architected', 'implemented'];
    const matchedVerbs = actionVerbs.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(resumeText));

    const wordCount = resumeText.trim().split(/\s+/).length;
    let structureScore = 0;
    if (hasEmail) structureScore += 25;
    if (hasPhone) structureScore += 25;
    if (hasGithub) structureScore += 25;
    if (hasLinkedin) structureScore += 25;

    let lengthFeedback = 'Good word count.';
    if (wordCount < 150) lengthFeedback = 'Resume text is too brief. Expand on your project details and experience.';
    else if (wordCount > 1500) lengthFeedback = 'Resume is very long. Consider condensing bullet points.';

    // Step 2: AI Refinement
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(200).json({
        data: {
          structureScore,
          impactScore: Math.min(100, matchedVerbs.length * 15),
          wordCount,
          feedback: `Local review: Email found: ${hasEmail}, Phone found: ${hasPhone}, Github found: ${hasGithub}. Action verbs count: ${matchedVerbs.length}. ${lengthFeedback}`
        }
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Review the following resume content for structure, impact, clarity, action verbs, and readability.
    
    Resume Text:
    ${resumeText}

    Evaluate and return a structureScore (0-100), impactScore (0-100), and a structured review.
    Return ONLY clean JSON code. No markdown boxes. Use this structure:
    {
      "structureScore": number,
      "impactScore": number,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "recommendations": ["rec1", "rec2"]
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const fallback = {
      structureScore,
      impactScore: Math.min(100, matchedVerbs.length * 15),
      strengths: ['Included core contact info'],
      weaknesses: ['AI analysis issue'],
      recommendations: [lengthFeedback]
    };

    res.json({ data: safeParseJson(text, fallback) });
  } catch (error) {
    console.error('Resume review error:', error);
    res.status(500).json({ error: 'Server error analyzing resume' });
  }
};

/**
 * Endpoint 3: Skill Gap Analysis
 * Analyzes target role/skills gaps
 */
export const getSkillGap = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { targetRole } = req.body;
    const userId = req.user?.id;

    if (!targetRole) {
      res.status(400).json({ error: 'targetRole is required' });
      return;
    }

    // Resolve user skills
    let userSkills: string[] = [];
    if (userId) {
      const skillsInDb = await SkillModel.find({ userId });
      userSkills = skillsInDb.map(s => s.name.toLowerCase().trim());
    }

    // Heuristics baseline gap analysis
    const roleKey = String(targetRole).toLowerCase().replace(/[\s-]/g, '');
    let coreRoleSkills: string[] = [];
    
    // Check closest match in role map
    if (roleKey.includes('front')) coreRoleSkills = ROLE_SKILLS_MAP.frontend;
    else if (roleKey.includes('back')) coreRoleSkills = ROLE_SKILLS_MAP.backend;
    else if (roleKey.includes('devops') || roleKey.includes('cloud')) coreRoleSkills = ROLE_SKILLS_MAP.devops;
    else coreRoleSkills = ROLE_SKILLS_MAP.fullstack; // Default fallback

    const missingSkills = coreRoleSkills.filter(s => !userSkills.includes(s));
    const gapScore = coreRoleSkills.length > 0 
      ? Math.round((missingSkills.length / coreRoleSkills.length) * 100) 
      : 0;

    // AI Refinement
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(200).json({
        data: {
          gapPercentage: gapScore,
          missingSkills,
          roadmap: missingSkills.map(s => `Learn ${s} via official docs`),
          resources: ['MDN Web Docs', 'AWS Documentation', 'Docker Docs']
        }
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Conduct a skill gap analysis for a candidate targeting the role: "${targetRole}".
    
    Candidate's Current Skills:
    ${userSkills.join(', ')}

    Analyze what tools, frameworks, or concepts they are missing to be fully competitive for this role.
    Provide a gapPercentage (0-100), list of missingSkills, a step-by-step roadmap to acquire them, and learning resource suggestions.
    Return ONLY clean JSON code. No markdown boxes. Use this structure:
    {
      "gapPercentage": number,
      "missingSkills": ["skill1", "skill2"],
      "roadmap": ["step1", "step2"],
      "resources": ["resource1", "resource2"]
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const fallback = {
      gapPercentage: gapScore,
      missingSkills,
      roadmap: missingSkills.map(s => `Master ${s} by building small demo apps.`),
      resources: ['YouTube Tutorials', 'MDN Docs', 'StackOverflow']
    };

    res.json({ data: safeParseJson(text, fallback) });
  } catch (error) {
    console.error('Skill gap error:', error);
    res.status(500).json({ error: 'Server error conducting skill gap analysis' });
  }
};

/**
 * Endpoint 4: Recruiter Readiness / Portfolio Score
 * Analyzes overall profile completeness, projects, skills, certifications, and GitHub Sync scores
 */
export const getReadinessScore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const [portfolio, projects, skills, certifications, resumes] = await Promise.all([
      PortfolioModel.findOne({ ownerId: userId }),
      ProjectModel.find({ ownerId: userId, status: { $ne: 'archived' } }),
      SkillModel.find({ userId }),
      CertificationModel.find({ userId }),
      ResumeModel.find({ userId })
    ]);

    // Completeness Calculations
    let score = 0;
    const breakdown: Record<string, number> = {};

    // Avatar + Bio: 20%
    const hasAvatar = !!user.avatarUrl || (portfolio && !!portfolio.ownerId); // simple fallback
    const hasBio = !!user.bio || (portfolio && !!portfolio.bio);
    
    breakdown.profileCompleteness = 0;
    if (hasAvatar) breakdown.profileCompleteness += 10;
    if (hasBio) breakdown.profileCompleteness += 10;
    score += breakdown.profileCompleteness;

    // Resume Upload: 20%
    const hasResume = resumes.length > 0;
    breakdown.resumeScore = hasResume ? 20 : 0;
    score += breakdown.resumeScore;

    // Skills Listed (min 5 for full points): 20%
    const skillCount = skills.length;
    breakdown.skillsScore = Math.min(20, Math.round((skillCount / 5) * 20));
    score += breakdown.skillsScore;

    // Projects Listed (min 3 for full points): 20%
    const projectCount = projects.length;
    breakdown.projectsScore = Math.min(20, Math.round((projectCount / 3) * 20));
    score += breakdown.projectsScore;

    // Certifications (min 1): 10%
    const hasCerts = certifications.length > 0;
    breakdown.certificationsScore = hasCerts ? 10 : 0;
    score += breakdown.certificationsScore;

    // GitHub Integration & Score check: 10%
    const githubUsername = user.githubUsername || (portfolio && portfolio.githubUsername);
    let githubProfileScore = 0;
    let githubStats = null;
    
    if (githubUsername) {
      try {
        githubStats = await fetchGitHubStats(githubUsername);
        if (githubStats && githubStats.scores) {
          githubProfileScore = githubStats.scores.developerProfile || 0;
        }
      } catch (err) {
        console.warn('GitHub stats fetch failed for readiness score:', err);
      }
      breakdown.githubIntegrationScore = 10;
    } else {
      breakdown.githubIntegrationScore = 0;
    }
    score += breakdown.githubIntegrationScore;

    // Construct recommendations
    const tips: string[] = [];
    if (!hasAvatar) tips.push('Add an avatar/profile picture to customize your brand.');
    if (!hasBio) tips.push('Write a short bio detailing your professional aspirations and core stack.');
    if (!hasResume) tips.push('Upload a PDF copy of your resume to make it download-ready for recruiters.');
    if (skillCount < 5) tips.push(`Add ${5 - skillCount} more skills to your profile to highlight technical breadth.`);
    if (projectCount < 3) tips.push(`List ${3 - projectCount} more projects showing real-world problem-solving.`);
    if (!hasCerts) tips.push('Add certifications or courses to demonstrate continuous learning.');
    if (!githubUsername) tips.push('Connect your GitHub account to sync repo stats and contribution metrics.');

    res.status(200).json({
      data: {
        overallScore: Math.min(100, score),
        breakdown,
        githubProfileScore,
        recommendations: tips.length > 0 ? tips : ['Your profile looks fully optimized! Ready for recruiter review.']
      }
    });
  } catch (error) {
    console.error('Readiness score error:', error);
    res.status(500).json({ error: 'Server error computing recruiter readiness score' });
  }
};
