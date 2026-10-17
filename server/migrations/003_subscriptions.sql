-- Migration 003: Subscription Plans
-- Adds subscription and plan tracking to support Freemium billing model

-- Plans reference table
CREATE TABLE IF NOT EXISTS plans (
    plan_id     VARCHAR(20) PRIMARY KEY,  -- 'free', 'pro', 'team'
    name        VARCHAR(50)  NOT NULL,
    price_usd   NUMERIC(8,2) NOT NULL DEFAULT 0,
    interview_limit_monthly INTEGER,       -- NULL = unlimited
    features    JSONB        NOT NULL DEFAULT '{}',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO plans (plan_id, name, price_usd, interview_limit_monthly, features) VALUES
  ('free',  'Free',  0,   3,    '{"resume_upload":false,"jd_match":false,"pdf_reports":false,"analytics":false,"recruiter":false}'),
  ('pro',   'Pro',   12,  NULL, '{"resume_upload":true,"jd_match":true,"pdf_reports":true,"analytics":true,"recruiter":false,"priority_ai":true}'),
  ('team',  'Team',  49,  NULL, '{"resume_upload":true,"jd_match":true,"pdf_reports":true,"analytics":true,"recruiter":true,"priority_ai":true,"seats":5}'),
  ('enterprise','Enterprise',0,NULL,'{"resume_upload":true,"jd_match":true,"pdf_reports":true,"analytics":true,"recruiter":true,"priority_ai":true,"sso":true,"custom_branding":true}')
ON CONFLICT DO NOTHING;

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    plan_id                 VARCHAR(20) NOT NULL REFERENCES plans(plan_id),
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','cancelled','past_due','trialing','paused')),
    stripe_customer_id      VARCHAR(100),
    stripe_subscription_id  VARCHAR(100),
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- Interview usage counters (reset monthly)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS interviews_this_month INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Default free plan for all existing users
INSERT INTO subscriptions (user_id, plan_id, status)
SELECT user_id, 'free', 'active'
FROM users
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = users.user_id)
ON CONFLICT DO NOTHING;
