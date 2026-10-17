import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { UserRepository } from './user.repository';

const router = Router();
const repo = new UserRepository();

// GET /api/user/dashboard
router.get('/dashboard', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await repo.getDashboard(req.user!.user_id);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
});

export default router;
