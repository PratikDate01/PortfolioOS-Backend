import { Router } from 'express';
import { register, login, getMe, guestLogin } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../middleware/schemas';
import { UserModel } from '../models/user.model';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-portfolio-os-secret-key-12345';
const JWT_EXPIRES_IN = '1d';

const generateToken = (payload: { id: string; role: string; email: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/guest', guestLogin);
router.get('/me', protect, getMe);

// OAuth Google Auth Route
router.get('/google', (req, res) => {
  const email = 'google-developer@portfolio-os.local';
  const name = 'Google Developer';
  
  // Find or create user
  UserModel.findOne({ email }).then(async (user) => {
    let finalUser = user;
    if (!user) {
      finalUser = new UserModel({
        name,
        email,
        authProvider: 'google',
        providerId: 'google_mock_id_12345',
        role: 'member',
        xp: 120,
        level: 1,
        isVerified: true
      });
      await finalUser.save();
    }
    const token = generateToken({ id: finalUser!._id.toString(), role: finalUser!.role, email: finalUser!.email });
    res.redirect(`http://localhost:3000/login?token=${token}`);
  }).catch(err => {
    console.error(err);
    res.redirect('http://localhost:3000/login?error=oauth_failed');
  });
});

// OAuth GitHub Auth Route
router.get('/github', (req, res) => {
  const email = 'github-coder@portfolio-os.local';
  const name = 'GitHub Coder';

  // Find or create user
  UserModel.findOne({ email }).then(async (user) => {
    let finalUser = user;
    if (!user) {
      finalUser = new UserModel({
        name,
        email,
        authProvider: 'github',
        providerId: 'github_mock_id_67890',
        role: 'member',
        xp: 150,
        level: 1,
        isVerified: true
      });
      await finalUser.save();
    }
    const token = generateToken({ id: finalUser!._id.toString(), role: finalUser!.role, email: finalUser!.email });
    res.redirect(`http://localhost:3000/login?token=${token}`);
  }).catch(err => {
    console.error(err);
    res.redirect('http://localhost:3000/login?error=oauth_failed');
  });
});

export default router;
