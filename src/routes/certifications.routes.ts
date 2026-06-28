import { Router } from 'express';
import {
  getCertifications,
  getCertificationById,
  createCertification,
  updateCertification,
  deleteCertification,
} from '../controllers/certifications.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { certificationSchema } from '../middleware/schemas';

const router = Router();

router.get('/', optionalProtect, getCertifications);
router.get('/:id', getCertificationById);

// Admin-only certification operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(certificationSchema), createCertification);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(certificationSchema), updateCertification);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteCertification);

export default router;
