import { Router } from 'express';
import { register, login, getMe, handleOAuthCallback, refresh, logout } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../middleware/schemas';
import { UserModel } from '../models/user.model';

const router = Router();

// ─── Core Auth Routes ───────────────────────────────────────────────────
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// ─── Check username availability ────────────────────────────────────────
router.get('/check-username/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    if (username.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters' });
      return;
    }
    const exists = await UserModel.findOne({ username }).lean();
    res.json({ data: { available: !exists } });
  } catch {
    res.status(500).json({ error: 'Server error checking username' });
  }
});

// ─── OAuth Routes (Mock for Development) ────────────────────────────────
// In production, these would be replaced with real Passport.js strategies.
// The mock routes simulate the OAuth flow for local development.

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${backendUrl}/api/v1/auth/google/callback`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId || '')}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const frontendUrl = process.env.FRONTEND_URL || 'https://app.portfolioos.workers.dev';

  if (error || !code) {
    console.error('Google OAuth error or missing code:', error);
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    return;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${backendUrl}/api/v1/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('Google token exchange failed:', errBody);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      return;
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Fetch user profile info
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      const errBody = await userinfoResponse.text();
      console.error('Google userinfo retrieval failed:', errBody);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      return;
    }

    const profile = await userinfoResponse.json() as {
      sub: string;
      name: string;
      email: string;
      picture?: string;
    };

    // Call handleOAuthCallback helper
    await handleOAuthCallback(
      'google',
      {
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        providerId: profile.sub,
        avatarUrl: profile.picture,
      },
      res
    );
  } catch (err) {
    console.error('Exception during Google OAuth callback:', err);
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

router.get('/github', (req, res) => {
  handleOAuthCallback(
    'github',
    {
      name: 'GitHub Coder',
      email: 'github-coder@portfolio-os.local',
      providerId: 'github_mock_id_67890',
      avatarUrl: 'https://ui-avatars.com/api/?name=GitHub+Coder&background=24292e&color=fff',
    },
    res
  );
});

export default router;
