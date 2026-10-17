import { query, queryOne } from '../../config/database';
import { User } from '../../types';

export class AuthRepository {
    async createUser(data: {
        full_name: string;
        email: string;
        password_hash: string;
        email_verification_token?: string;
        email_verification_expires?: Date;
    }): Promise<User> {
        const rows = await query<User>(
            `INSERT INTO users (full_name, email, password_hash, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, full_name, is_active, email_verified,
                 email_verification_token, email_verification_expires,
                 created_at, updated_at`,
            [
                data.full_name,
                data.email,
                data.password_hash,
                data.email_verification_token ?? null,
                data.email_verification_expires ?? null,
            ]
        );
        return rows[0];
    }

    async findByEmail(email: string): Promise<User | null> {
        return queryOne<User>(
            `SELECT user_id, email, full_name, password_hash, is_active, email_verified,
                    email_verification_token, email_verification_expires,
                    created_at, updated_at
       FROM users WHERE email = $1`,
            [email]
        );
    }

    async findById(user_id: string): Promise<User | null> {
        return queryOne<User>(
            `SELECT user_id, email, full_name, is_active, email_verified, created_at, updated_at
       FROM users WHERE user_id = $1`,
            [user_id]
        );
    }

    async findByVerificationToken(token: string): Promise<User | null> {
        return queryOne<User>(
            `SELECT user_id, email, full_name, is_active, email_verified,
                    email_verification_token, email_verification_expires
             FROM users
             WHERE email_verification_token = $1`,
            [token]
        );
    }

    async markEmailVerified(user_id: string): Promise<void> {
        await query(
            `UPDATE users
             SET email_verified = TRUE,
                 email_verification_token = NULL,
                 email_verification_expires = NULL,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [user_id]
        );
    }

    async storeRefreshToken(data: {
        user_id: string;
        token_hash: string;
        expires_at: Date;
    }): Promise<void> {
        await query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
            [data.user_id, data.token_hash, data.expires_at]
        );
    }

    async findRefreshToken(token_hash: string): Promise<{ user_id: string; expires_at: Date; revoked_at: Date | null } | null> {
        return queryOne(
            `SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
            [token_hash]
        );
    }

    async revokeRefreshToken(token_hash: string): Promise<void> {
        await query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
            [token_hash]
        );
    }
}
