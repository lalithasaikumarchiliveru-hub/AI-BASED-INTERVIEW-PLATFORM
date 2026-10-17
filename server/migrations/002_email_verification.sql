-- Migration 002: Email Verification
-- Adds a verification token column to users table

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_verification_token
    ON users(email_verification_token)
    WHERE email_verification_token IS NOT NULL;
