import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserModel } from '../models/user.model';
import { PortfolioModel } from '../models/portfolio.model';
import { ProjectModel } from '../models/project.model';
import { SkillModel } from '../models/skill.model';
import { ExperienceModel } from '../models/experience.model';
import { CertificationModel } from '../models/certification.model';
import { safeParseJson } from '../utils/json';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// In-memory session storage (message history per session)
const sessions = new Map<string, { role: string; content: string }[]>();
const SESSION_MAX_MESSAGES = 20;

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15; // requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Dynamically builds a system prompt based on user portfolio context from DB
 */
function buildSystemPrompt(user: any, portfolio: any, projects: any[], skills: any[], experiences: any[], certs: any[]): string {
  const name = user.name;
  const email = user.email;
  const github = user.githubUsername || portfolio.githubUsername || 'Not provided';
  const bio = portfolio.bio || user.bio || '';
  
  const projectsText = projects
    .map((p, idx) => `${idx + 1}. ${p.title} — ${p.summary} (Tech: ${p.techStack.join(', ')})`)
    .join('\n');

  const skillsText = skills
    .map(s => `- ${s.name} (${s.category}, Proficiency: ${s.proficiency}%)`)
    .join('\n');

  const expText = experiences
    .map(e => {
      const start = e.startDate ? new Date(e.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '';
      const end = e.endDate ? new Date(e.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : 'Present';
      return `- ${e.role} at ${e.organization} (${e.type}, ${start} - ${end}): ${e.description}`;
    })
    .join('\n');

  const certText = certs
    .map(c => `- ${c.title} issued by ${c.issuer}`)
    .join('\n');

  return `You are an AI assistant on ${name}'s portfolio website. Your job is to answer questions about ${name}'s skills, projects, experience, and education in a helpful, friendly, and professional manner.

Here is ${name}'s professional background:

**About:**
- Full name: ${name}
- Email: ${email}
- GitHub: ${github}
- Bio: ${bio}

**Work Experience:**
${expText || 'No experience listed yet.'}

**Projects:**
${projectsText || 'No projects listed yet.'}

**Skills:**
${skillsText || 'No skills listed yet.'}

**Certifications:**
${certText || 'No certifications listed yet.'}

Rules:
- Only answer questions related to ${name}'s portfolio, skills, projects, and professional background.
- If asked about something unrelated, politely redirect the conversation to ${name}'s portfolio.
- Keep responses concise (2-4 sentences unless more detail is requested).
- Be enthusiastic about ${name}'s work but honest — don't exaggerate.
- If you don't know something specific about ${name}, say so rather than making things up.`;
}

/**
 * Hardcoded fallback for rate limits or api issues
 */
function getLocalFallbackResponse(
  message: string,
  user: any,
  projects: any[],
  skills: any[],
  experiences: any[],
  certs: any[]
): string {
  const msg = message.toLowerCase();
  const name = user.name;
  
  if (msg.includes('contact') || msg.includes('email') || msg.includes('phone') || msg.includes('call') || msg.includes('reach') || msg.includes('linkedin') || msg.includes('github')) {
    return `You can reach ${name} via email at ${user.email}. You can also check out their GitHub profile at github.com/${user.githubUsername || 'username'}.`;
  }
  
  if (msg.includes('skill') || msg.includes('tech') || msg.includes('languages') || msg.includes('database') || msg.includes('framework')) {
    const list = skills.map(s => s.name).slice(0, 8).join(', ');
    return `${name}'s core technical skills include: ${list || 'various software engineering disciplines'}.`;
  }
  
  if (msg.includes('project') || msg.includes('build') || msg.includes('make') || msg.includes('work')) {
    const list = projects.map(p => p.title).slice(0, 5).join(', ');
    return `${name} has worked on several projects, including: ${list || 'creative software solutions'}.`;
  }
  
  if (msg.includes('experience') || msg.includes('intern') || msg.includes('job')) {
    const list = experiences.map(e => `${e.role} at ${e.organization}`).slice(0, 3).join(', ');
    return `${name}'s experience includes: ${list || 'various professional engagements'}.`;
  }
  
  return `I'd love to chat more about ${name}'s skills and background! However, the AI assistant is currently experiencing high request volumes. Please browse the sections of the page or contact ${name} directly.`;
}

export const chatWithAI = async (req: AuthenticatedRequest, res: Response) => {
  let sid = sessionIdFromReq(req);
  let history: { role: string; content: string }[] | undefined;
  
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before sending another message.',
      });
    }

    const { message, sessionId, username } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Resolve tenant details dynamically
    let targetUser = null;
    if (username) {
      targetUser = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Tenant context not found' });
    }

    const ownerId = targetUser._id;
    const portfolio = await PortfolioModel.findOne({ ownerId });
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio context not found' });
    }

    // Access protection check
    const isOwner = req.user?.id && req.user.id.toString() === ownerId.toString();
    if (portfolio.visibility !== 'public' && !isOwner) {
      return res.status(403).json({ error: 'Access denied. This portfolio is not public.' });
    }

    const projects = await ProjectModel.find({ ownerId, status: 'published' });
    const skills = await SkillModel.find({ ownerId });
    const experiences = await ExperienceModel.find({ ownerId });
    const certs = await CertificationModel.find({ ownerId });

    const systemPrompt = buildSystemPrompt(targetUser, portfolio, projects, skills, experiences, certs);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackReply = getLocalFallbackResponse(message, targetUser, projects, skills, experiences, certs);
      return res.json({
        data: {
          reply: `${fallbackReply}\n\n*(Note: The AI assistant is currently using a lightweight local engine.)*`,
          sessionId: sid,
          isFallback: true
        }
      });
    }

    // Get or create session
    sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!sessions.has(sid)) {
      sessions.set(sid, []);
    }

    history = sessions.get(sid)!;
    history.push({ role: 'user', content: message.trim() });

    if (history.length > SESSION_MAX_MESSAGES) {
      history.splice(0, history.length - SESSION_MAX_MESSAGES);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const conversationText = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\nConversation so far:\n${conversationText}\n\nAssistant:`;

    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text().trim();

    history.push({ role: 'assistant', content: reply });

    res.json({
      data: {
        reply,
        sessionId: sid,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
};

/**
 * AI RESUME PARSING ENDPOINT
 */
export const parseResume = async (req: Request, res: Response) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: 'resumeText is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Parse the following resume text and structure it as JSON containing lists of:
    1. "skills" (array of strings)
    2. "experience" (array of objects with keys: organization, role, description, startDate, endDate)
    3. "education" (array of objects with keys: institution, degree, year)
    Return ONLY clean JSON code. No markdown boxes.
    
    Resume content:
    ${resumeText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const fallback = { skills: [], experience: [], education: [] };
    res.json({ data: safeParseJson(text, fallback) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse resume with AI' });
  }
};

/**
 * AI BIO GENERATOR
 */
export const generateBio = async (req: Request, res: Response) => {
  try {
    const { skills, role, style } = req.body; // style: creative, corporate, professional, brief
    if (!skills || !role) {
      return res.status(400).json({ error: 'skills and role parameters are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Generate a compelling developer biography for a portfolio.
    Role: ${role}
    Key skills: ${skills.join(', ')}
    Tone style: ${style || 'professional'}
    Keep the bio under 120 words.`;

    const result = await model.generateContent(prompt);
    res.json({ data: { bio: result.response.text().trim() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate biography with AI' });
  }
};

/**
 * AI PROJECT DESCRIPTION GENERATOR
 */
export const generateProjectDesc = async (req: Request, res: Response) => {
  try {
    const { title, techStack, summary } = req.body;
    if (!title || !techStack) {
      return res.status(400).json({ error: 'title and techStack parameters are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Write an detailed project description for a developer case study.
    Project Title: ${title}
    Tech Stack: ${techStack.join(', ')}
    Basic outline: ${summary || ''}
    
    Format the description into 3 logical sections:
    1. Problem Statement
    2. Challenges & Tech Choices
    3. Results & Achievements
    
    Make it sound modern, professional, and impact-driven.`;

    const result = await model.generateContent(prompt);
    res.json({ data: { description: result.response.text().trim() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate project description' });
  }
};

/**
 * AI SKILLS EXTRACTOR
 */
export const extractSkills = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for skills extraction' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this text and extract all software engineering, technical, and programming language skills.
    Return ONLY a JSON array of strings containing the skills.
    
    Text:
    ${text}`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    res.json({ data: safeParseJson<string[]>(rawText, []) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract skills with AI' });
  }
};

/**
 * AI EXPERIENCE FORMATTER
 */
export const formatExperience = async (req: Request, res: Response) => {
  try {
    const { role, organization, description } = req.body;
    if (!role || !description) {
      return res.status(400).json({ error: 'role and description parameters are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Transform the following job description into professional resume bullet points.
    Role: ${role} at ${organization || 'Company'}
    Input description: ${description}
    
    Generate 3-4 bullet points starting with strong action verbs (e.g. Led, Developed, Optimized) and include metrics/impacts where possible.`;

    const result = await model.generateContent(prompt);
    res.json({ data: { formattedPoints: result.response.text().trim() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to format experience with AI' });
  }
};

/**
 * AI SEO OPTIMIZER
 */
export const optimizeSeo = async (req: Request, res: Response) => {
  try {
    const { name, bio, role } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'name and role parameters are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Generate optimized SEO title and meta description tag settings for a developer's portfolio website.
    Name: ${name}
    Role: ${role}
    Bio: ${bio || ''}
    
    Return ONLY a JSON object containing keys "title" and "description".`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const fallback = { title: `${name} | ${role}`, description: bio || '' };
    res.json({ data: safeParseJson(rawText, fallback) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to optimize SEO tags' });
  }
};

/**
 * AI PORTFOLIO REVIEWER
 */
export const reviewPortfolio = async (req: Request, res: Response) => {
  try {
    const { name, bio, projectsCount, skillsCount } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Act as an expert technical recruiter and portfolio reviewer.
    Critique this portfolio summary:
    Developer: ${name}
    Biography: ${bio || 'None listed'}
    Number of projects: ${projectsCount || 0}
    Number of skills: ${skillsCount || 0}
    
    Provide constructive critique in bullet points, highlighting:
    1. Strengths
    2. Weaknesses / Gaps
    3. Exact tips to make it more appealing to tech recruiters.`;

    const result = await model.generateContent(prompt);
    res.json({ data: { critique: result.response.text().trim() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review portfolio with AI' });
  }
};

/**
 * AI RESUME REVIEWER
 */
export const reviewResume = async (req: Request, res: Response) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: 'resumeText is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Review this resume text as a hiring manager. Highlight grammar errors, action-verb suggestions, formatting issues, and rate its layout out of 100.
    
    Resume:
    ${resumeText}`;

    const result = await model.generateContent(prompt);
    res.json({ data: { review: result.response.text().trim() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review resume with AI' });
  }
};

/**
 * AI PORTFOLIO GENERATOR (creates default structures)
 */
export const generatePortfolioTemplate = async (req: Request, res: Response) => {
  try {
    const { name, role, details } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'name and role parameters are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Generate portfolio settings, sample project outlines, and skill categories for a developer.
    Developer name: ${name}
    Role: ${role}
    Background: ${details || 'None'}
    
    Return ONLY a JSON containing keys: "headline", "bio", "suggestedProjects" (array of title/summary), "suggestedSkills" (array of name/category).
    No markdown formatting blocks.`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const fallback = {
      headline: `${role} at PortfolioOS`,
      bio: `I am ${name}, working as a ${role}.`,
      suggestedProjects: [],
      suggestedSkills: []
    };
    res.json({ data: safeParseJson(rawText, fallback) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate portfolio template' });
  }
};

function sessionIdFromReq(req: Request): string {
  const { sessionId } = req.body;
  return sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
