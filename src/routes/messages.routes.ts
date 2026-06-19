import { Router } from 'express';
import { getMessages, createMessage, updateMessageStatus } from '../controllers/messages.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { messageSchema } from '../middleware/schemas';

const router = Router();

// Public contact form submission
router.post('/', optionalProtect, validate(messageSchema), createMessage);

// Admin-only operations
router.get('/', protect, restrictTo('owner', 'admin'), getMessages);
router.patch('/:id/status', protect, restrictTo('owner', 'admin'), updateMessageStatus);

export default router;
