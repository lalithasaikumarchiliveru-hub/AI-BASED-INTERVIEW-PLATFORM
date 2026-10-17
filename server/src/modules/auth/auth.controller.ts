import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput } from './auth.schema';

const service = new AuthService();

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const input = req.body as RegisterInput;
            const result = await service.register(input);
            res.status(201).json({
                success: true,
                data: {
                    user: result.user,
                    access_token: result.accessToken,
                    refresh_token: result.refreshToken,
                    token_type: 'Bearer',
                    expires_in: 3600,
                    email_verification_sent: result.emailSent,
                },
                message: 'Account created successfully. Please check your email to verify your account.',
            });
        } catch (err) { next(err); }
    }

    async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const token = req.query.token as string;
            if (!token) {
                res.status(400).json({ success: false, error: 'Verification token is required' });
                return;
            }
            const result = await service.verifyEmail(token);
            res.status(200).json({
                success: true,
                data: { email: result.email },
                message: 'Email verified successfully! You can now log in.',
            });
        } catch (err) { next(err); }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const input = req.body as LoginInput;
            const result = await service.login(input);
            res.status(200).json({
                success: true,
                data: {
                    user: result.user,
                    access_token: result.accessToken,
                    refresh_token: result.refreshToken,
                    token_type: 'Bearer',
                    expires_in: 3600,
                },
            });
        } catch (err) { next(err); }
    }

    async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { refresh_token } = req.body;
            const tokens = await service.refreshTokens(refresh_token);
            res.status(200).json({
                success: true,
                data: {
                    access_token: tokens.accessToken,
                    refresh_token: tokens.refreshToken,
                    token_type: 'Bearer',
                    expires_in: 3600,
                },
            });
        } catch (err) { next(err); }
    }
}
