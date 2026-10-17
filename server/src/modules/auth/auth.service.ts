import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';
import { User, JwtPayload } from '../../types';
import { logger } from '../../utils/logger';

const repo = new AuthRepository();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';
const BCRYPT_ROUNDS = 12;

function generateTokens(payload: JwtPayload) {
    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY as any });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY as any });
    return { accessToken, refreshToken };
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Send a verification email (or log the link in dev/mock mode). */
async function sendVerificationEmail(email: string, token: string): Promise<void> {
    const APP_URL = process.env.APP_URL || 'http://localhost:3000';
    const verifyUrl = `${APP_URL}/verify-email.html?token=${token}`;

    // ── In production: plug in SendGrid / Resend / AWS SES here ────────────
    // For dev/mock mode we just log the link so you can test without SMTP.
    if (!process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.example.com') {
        logger.info('📧 [DEV] Email verification link (copy into browser to verify):', {
            email,
            verifyUrl,
        });
        return;
    }

    // ── Production path: nodemailer ─────────────────────────────────────────
    try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        await transporter.sendMail({
            from: `"AI Interview Prep" <${process.env.SMTP_FROM || 'noreply@aiinterviewprep.com'}>`,
            to: email,
            subject: 'Verify your email — AI Interview Prep',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:auto">
                    <h2 style="color:#6c63ff">Welcome to AI Interview Prep 🎉</h2>
                    <p>Click the button below to verify your email address:</p>
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:12px 24px;background:#6c63ff;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
                       Verify Email
                    </a>
                    <p style="color:#888;font-size:12px;margin-top:16px">Link expires in 24 hours.</p>
                </div>`,
        });
        logger.info('Verification email sent', { email });
    } catch (err: any) {
        logger.warn('Failed to send verification email — continuing without it', { error: err.message });
    }
}

export class AuthService {
    async register(input: RegisterInput): Promise<{ user: Partial<User>; accessToken: string; refreshToken: string; emailSent: boolean }> {
        const existing = await repo.findByEmail(input.email);
        if (existing) {
            throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
        }

        const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

        // Generate a 32-byte hex verification token, expires in 24h
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await repo.createUser({
            ...input,
            password_hash,
            email_verification_token: verificationToken,
            email_verification_expires: tokenExpiry,
        });

        const payload: JwtPayload = { user_id: user.user_id, email: user.email };
        const { accessToken, refreshToken } = generateTokens(payload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await repo.storeRefreshToken({ user_id: user.user_id, token_hash: hashToken(refreshToken), expires_at: expiresAt });

        // Send verification email (non-blocking)
        let emailSent = true;
        try {
            await sendVerificationEmail(user.email, verificationToken);
        } catch {
            emailSent = false;
        }

        logger.info('User registered', { user_id: user.user_id, email: user.email });

        const { password_hash: _, email_verification_token: __, ...safeUser } = user as any;
        return { user: safeUser, accessToken, refreshToken, emailSent };
    }

    async verifyEmail(token: string): Promise<{ email: string }> {
        const user = await repo.findByVerificationToken(token);
        if (!user) {
            throw new AppError(400, 'Invalid or expired verification link', 'INVALID_VERIFICATION_TOKEN');
        }
        if (user.email_verified) {
            return { email: user.email }; // Already verified — just return success
        }
        const expiry = user.email_verification_expires ? new Date(user.email_verification_expires) : null;
        if (expiry && expiry < new Date()) {
            throw new AppError(400, 'Verification link has expired. Please register again.', 'VERIFICATION_EXPIRED');
        }
        await repo.markEmailVerified(user.user_id);
        logger.info('Email verified', { user_id: user.user_id, email: user.email });
        return { email: user.email };
    }

    async login(input: LoginInput): Promise<{ user: Partial<User>; accessToken: string; refreshToken: string }> {
        const user = await repo.findByEmail(input.email);
        const passwordToCheck = user?.password_hash || '$2b$12$invalidhashforcomparisonpurposesonly';
        const isValid = await bcrypt.compare(input.password, passwordToCheck);

        if (!user || !isValid) {
            throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
        }
        if (!user.is_active) {
            throw new AppError(403, 'Account is deactivated', 'ACCOUNT_INACTIVE');
        }

        const payload: JwtPayload = { user_id: user.user_id, email: user.email };
        const { accessToken, refreshToken } = generateTokens(payload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await repo.storeRefreshToken({ user_id: user.user_id, token_hash: hashToken(refreshToken), expires_at: expiresAt });

        logger.info('User logged in', { user_id: user.user_id });

        const { password_hash: _, email_verification_token: __, ...safeUser } = user as any;
        return { user: safeUser, accessToken, refreshToken };
    }

    async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
        } catch {
            throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
        }

        const tokenHash = hashToken(refreshToken);
        const stored = await repo.findRefreshToken(tokenHash);

        if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
            throw new AppError(401, 'Refresh token has been revoked or expired', 'REFRESH_TOKEN_INVALID');
        }

        await repo.revokeRefreshToken(tokenHash);

        const payload: JwtPayload = { user_id: decoded.user_id, email: decoded.email };
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await repo.storeRefreshToken({ user_id: decoded.user_id, token_hash: hashToken(newRefreshToken), expires_at: expiresAt });

        return { accessToken, refreshToken: newRefreshToken };
    }
}
