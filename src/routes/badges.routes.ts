import { Router, Response, Request } from 'express';
import { BadgeModel } from '../models/badge.model';

const router = Router();

// GET /api/v1/badges - list all badges in system
router.get('/', async (req: Request, res: Response) => {
  try {
    const badges = await BadgeModel.find({});
    res.status(200).json({ data: badges });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch badge catalog' });
  }
});

export default router;
