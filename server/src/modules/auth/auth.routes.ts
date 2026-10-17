import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.schema';
import rateLimit from 'express-rate-limit';

const router = Router();
const controller = new AuthController();

const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_ATTEMPT_WINDOW_MS || '900000'),
    max: parseInt(process.env.LOGIN_ATTEMPT_LIMIT || '5'),
    message: { success: false, error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /api/auth/register
router.post('/register', validate(RegisterSchema), controller.register.bind(controller));

// POST /api/auth/login
router.post('/login', loginLimiter, validate(LoginSchema), controller.login.bind(controller));

// POST /api/auth/refresh
router.post('/refresh', validate(RefreshTokenSchema), controller.refresh.bind(controller));

// GET /api/auth/verify-email?token=...
router.get('/verify-email', controller.verifyEmail.bind(controller));

export default router;
