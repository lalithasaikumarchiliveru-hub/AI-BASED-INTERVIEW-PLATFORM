-- =============================================
-- Migration: Initial Schema
-- AI Mock Interview Platform
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================
-- USERS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(100) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ===========================
-- QUESTIONS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS questions (
    question_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text                TEXT NOT NULL,
    topic               VARCHAR(100) NOT NULL,
    difficulty          VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags                TEXT[] NOT NULL DEFAULT '{}',
    estimated_time_sec  INTEGER NOT NULL DEFAULT 120,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic_diff ON questions(topic, difficulty) WHERE is_active = TRUE;

-- ===========================
-- INTERVIEWS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS interviews (
    interview_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    topic           VARCHAR(100) NOT NULL,
    difficulty      VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
    overall_score   NUMERIC(5,2),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_status ON interviews(user_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_started_at ON interviews(started_at DESC);

-- ===========================
-- RESPONSES TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS responses (
    response_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id        UUID NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES questions(question_id),
    answer_text         TEXT NOT NULL,
    duration_seconds    INTEGER,
    score               NUMERIC(5,2),
    ai_feedback         JSONB,
    ai_processed_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(interview_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_interview_id ON responses(interview_id);
CREATE INDEX IF NOT EXISTS idx_responses_ai_feedback ON responses USING GIN(ai_feedback);

-- ===========================
-- REFRESH TOKENS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ===========================
-- TRIGGER: auto-update updated_at
-- ===========================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================
-- SEED: Sample Questions
-- ===========================
INSERT INTO questions (text, topic, difficulty, tags, estimated_time_sec) VALUES
  ('Tell me about yourself and your background.', 'behavioral', 'easy', ARRAY['introduction','communication'], 90),
  ('Describe a time when you faced a major challenge at work and how you overcame it.', 'behavioral', 'medium', ARRAY['problem-solving','resilience'], 150),
  ('Tell me about a time you disagreed with your manager. How did you handle it?', 'behavioral', 'hard', ARRAY['conflict','leadership','communication'], 180),
  ('What is the difference between a stack and a queue?', 'dsa', 'easy', ARRAY['data-structures','cs-fundamentals'], 90),
  ('Explain the time complexity of binary search and when you would use it.', 'dsa', 'medium', ARRAY['algorithms','complexity'], 120),
  ('Design a LRU (Least Recently Used) cache. Explain data structures and trade-offs.', 'dsa', 'hard', ARRAY['design','cache','data-structures'], 300),
  ('What is the difference between SQL and NoSQL databases?', 'system-design', 'easy', ARRAY['databases','architecture'], 120),
  ('How would you design a URL shortener like bit.ly?', 'system-design', 'medium', ARRAY['scalability','databases','hashing'], 300),
  ('Design a real-time chat application for 10 million concurrent users.', 'system-design', 'hard', ARRAY['websockets','scalability','distributed-systems'], 600),
  ('What is REST and what are its key principles?', 'behavioral', 'easy', ARRAY['api','web-development'], 90),
  ('Explain the difference between authentication and authorization.', 'dsa', 'easy', ARRAY['security','fundamentals'], 90),
  ('How would you handle a situation where your team is behind on a deadline?', 'behavioral', 'medium', ARRAY['leadership','time-management'], 150)
ON CONFLICT DO NOTHING;
