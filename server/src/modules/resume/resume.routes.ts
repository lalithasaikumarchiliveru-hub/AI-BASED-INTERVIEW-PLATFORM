import { Router } from 'express';
import multer from 'multer';
import { ResumeController } from './resume.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const ctrl = new ResumeController();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);
router.post('/upload', upload.single('resume'), ctrl.upload.bind(ctrl));
router.get('/current', ctrl.getCurrent.bind(ctrl));
router.post('/jd-match', ctrl.jdMatch.bind(ctrl));

export default router;
