import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// In-memory session storage (message history per session)
const sessions = new Map<string, { role: string; content: string }[]>();
const SESSION_MAX_MESSAGES = 20;

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
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

// System prompt with Pratik's portfolio context
const SYSTEM_PROMPT = `You are an AI assistant on Pratik Date's portfolio website. Your job is to answer questions about Pratik's skills, projects, experience, and education in a helpful, friendly, and professional manner.

Here is Pratik's background:

**About:**
- Full name: Pratik Satish Date
- Location: Pune, Maharashtra, India
- Email: pratikdate.sknsits.it@gmail.com
- Phone: +91 7666394641
- GitHub: github.com/PratikDate01
- LinkedIn: linkedin.com/in/pratik-date-a87025292

**Education:**
- B.E. in Information Technology — SKN Sinhgad Institute of Technology and Sciences, Lonavala (2024–2027)
- Diploma in Information Technology — Sou. Venutai Chavan Polytechnic, Pune (2021–2024)

**Work Experience:**
- Web Development Intern at Labmentix (Oct 2024 – Jan 2025): Built responsive UI with React.js, built REST APIs with Node.js & Express.js, integrated MongoDB for data management.
- AI/ML Virtual Intern at AICTE Edunet Foundation powered by IBM SkillsBuild (Feb 2025 – Apr 2025): Developed machine learning models, worked on computer vision and NLP projects, built AI prototypes using TensorFlow & Scikit-learn.

**Projects:**
1. SpeakWrite — Text-to-speech web app with custom voice options (HTML, CSS, JavaScript, React.js)
2. Mind Map Generator — Interactive visual tool for creating mind maps (HTML, CSS, JavaScript, React.js)
3. AI Code Reviewer System — AI-powered code review tool using Gemini API (Node.js, Express.js, React.js, Gemini API)
4. Online Freelance Marketplace — Full-stack platform connecting freelancers and clients (React.js, Node.js, Express.js, MongoDB)
5. Drive Clone System — Cloud file storage with secure auth (React.js, Node.js, Express.js, MongoDB, Cloud Storage)
6. Lost and Found Portal — Campus item recovery platform (React.js, Node.js, Express.js, MongoDB)

**Skills:**
- Frontend: HTML, CSS, JavaScript, TypeScript, React.js, Next.js, Tailwind CSS
- Backend: Node.js, Express.js, REST APIs
- Database: MongoDB, Mongoose, MySQL
- AI/ML: TensorFlow, Scikit-learn, Gemini API
- DevOps: Git, GitHub, Docker, Postman
- Cloud: AWS (Solutions Architecture), Vercel, Netlify

**Certifications:**
- Accenture North America — Software Engineering Job Simulation
- AWS Solutions Architecture — Job Simulation (Forage)
- Tata Group — GenAI Data Analytics Simulation
- Microsoft — Foundational C# with Microsoft
- IBM SkillsBuild — Web Development & AI Fundamentals

Rules:
- Only answer questions related to Pratik's portfolio, skills, projects, and professional background.
- If asked about something unrelated, politely redirect the conversation to Pratik's portfolio.
- Keep responses concise (2-4 sentences unless more detail is requested).
- Be enthusiastic about Pratik's work but honest — don't exaggerate.
- If you don't know something specific about Pratik, say so rather than making things up.`;

function getLocalFallbackResponse(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes('contact') || msg.includes('email') || msg.includes('phone') || msg.includes('call') || msg.includes('reach') || msg.includes('linkedin') || msg.includes('github')) {
    return "You can reach Pratik Satish Date via email at pratikdate.sknsits.it@gmail.com, or phone at +91 7666394641. You can also view his GitHub profile (github.com/PratikDate01) or connect with him on LinkedIn (linkedin.com/in/pratik-date-a87025292).";
  }
  
  if (msg.includes('skill') || msg.includes('tech') || msg.includes('languages') || msg.includes('database') || msg.includes('framework')) {
    return "Pratik's core technical skills include Frontend (HTML, CSS, JavaScript, TypeScript, React.js, Next.js, Tailwind CSS), Backend (Node.js, Express.js, REST APIs), Databases (MongoDB, Mongoose, MySQL), and tools/cloud platforms like AWS (Solutions Architecture), Docker, Git, and GitHub.";
  }
  
  if (msg.includes('project') || msg.includes('build') || msg.includes('make') || msg.includes('work')) {
    return "Pratik has built several impressive projects:\n1. **SpeakWrite**: Text-to-speech React app.\n2. **Mind Map Generator**: Visual mapping tool.\n3. **AI Code Reviewer System**: AI-powered feedback tool using Gemini.\n4. **Online Freelance Marketplace**: Full-stack platform.\n5. **Drive Clone System**: Cloud file storage.\n6. **Lost and Found Portal**: Campus item recovery platform.";
  }
  
  if (msg.includes('experience') || msg.includes('intern') || msg.includes('job')) {
    return "Pratik has completed two notable internships:\n1. **Web Development Intern at Labmentix** (Oct 2024 – Jan 2025): Developed React UIs, Express APIs, and MongoDB integrations.\n2. **AI/ML Virtual Intern at AICTE Edunet (IBM)** (Feb – Apr 2025): Developed TensorFlow prototypes and NLP/Computer Vision models.";
  }
  
  if (msg.includes('education') || msg.includes('college') || msg.includes('degree') || msg.includes('diploma') || msg.includes('study')) {
    return "Pratik is pursuing a B.E. in Information Technology at SKN Sinhgad Institute of Technology and Sciences, Lonavala (2024-2027). He also holds a Diploma in IT from Sou. Venutai Chavan Polytechnic, Pune (2021-2024).";
  }
  
  if (msg.includes('cert') || msg.includes('credential')) {
    return "Pratik holds multiple professional certifications, including software engineering and GenAI simulations from Accenture, AWS Solutions Architecture, Microsoft (Foundational C#), Tata Group (GenAI Data Analytics), and IBM SkillsBuild.";
  }
  
  return "I'd love to chat more about Pratik's skills and background! However, the AI chat is currently experiencing high demand and rate limits. Please check out the interactive sections on the page or contact Pratik directly at pratikdate.sknsits.it@gmail.com.";
}

export const chatWithAI = async (req: Request, res: Response) => {
  let sid = sessionIdFromReq(req);
  let history: { role: string; content: string }[] | undefined;
  
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before sending another message.',
      });
    }

    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 1000 characters.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    // Get or create session
    sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!sessions.has(sid)) {
      sessions.set(sid, []);
    }

    history = sessions.get(sid)!;
    history.push({ role: 'user', content: message.trim() });

    // Trim history to prevent token overflow
    if (history.length > SESSION_MAX_MESSAGES) {
      history.splice(0, history.length - SESSION_MAX_MESSAGES);
    }

    // Build conversation for Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const conversationText = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversationText}\n\nAssistant:`;

    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text().trim();

    // Store assistant reply
    history.push({ role: 'assistant', content: reply });

    res.json({
      data: {
        reply,
        sessionId: sid,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    
    // Check if it is a quota or rate-limit error (429 or containing quota/rate limit text)
    const errString = String(error).toLowerCase();
    const isQuotaError = 
      (error && (error as any).status === 429) || 
      errString.includes('quota') || 
      errString.includes('rate limit') || 
      errString.includes('too many requests') ||
      errString.includes('429');

    if (isQuotaError) {
      const { message } = req.body;
      const fallbackReply = getLocalFallbackResponse(message || '');
      
      // Store fallback reply in history if it exists
      if (history) {
        history.push({ role: 'assistant', content: fallbackReply });
      }

      return res.json({
        data: {
          reply: `${fallbackReply}\n\n*(Note: The AI assistant is currently using a lightweight local engine due to high service traffic.)*`,
          sessionId: sid,
          isFallback: true
        }
      });
    }

    res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
};

// Helper to safely get or initialize a session ID before try/catch
function sessionIdFromReq(req: Request): string {
  const { sessionId } = req.body;
  return sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
