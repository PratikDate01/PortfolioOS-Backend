import { Router } from 'express';
import { chatWithAI } from '../controllers/ai.controller';

const router = Router();

// POST /api/v1/ai/chat — public (rate-limited), send message, get AI reply
router.post('/chat', chatWithAI);

export default router;
