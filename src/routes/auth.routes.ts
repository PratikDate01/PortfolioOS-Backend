import { Router } from 'express';
import { register, login, getMe, guestLogin, handleOAuthCallback, refresh, logout } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../middleware/schemas';
import { UserModel } from '../models/user.model';

const router = Router();

// ─── Core Auth Routes ───────────────────────────────────────────────────
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/guest', guestLogin);
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
  handleOAuthCallback(
    'google',
    {
      name: 'Google Developer',
      email: 'google-developer@portfolio-os.local',
      providerId: 'google_mock_id_12345',
      avatarUrl: 'https://ui-avatars.com/api/?name=Google+Dev&background=4285F4&color=fff',
    },
    res
  );
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
