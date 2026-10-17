-- Migration 004: Resume storage
-- Stores user-uploaded resume data and AI-extracted skills

CREATE TABLE IF NOT EXISTS user_resumes (
    resume_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER,
    extracted_text  TEXT,
    skills_json     JSONB DEFAULT '[]',   -- array of skill strings
    topics_json     JSONB DEFAULT '[]',   -- suggested interview topics
    summary_text    TEXT,                 -- 2-3 line AI summary of candidate
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user ON user_resumes(user_id);

-- Only one active resume per user (deactivate old ones when uploading new)
-- Handled in application layer.


-- Migration 005: Recruiter Assessments
-- Allows recruiters to create shareable AI interview assessments

CREATE TABLE IF NOT EXISTS assessments (
    assessment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_name       VARCHAR(200) NOT NULL,
    company_name    VARCHAR(200),
    description     TEXT,
    config_json     JSONB NOT NULL DEFAULT '{}',
    -- config: { topic, difficulty, num_questions, time_limit_sec }
    share_token     VARCHAR(64) UNIQUE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_submissions (
    submission_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id       UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    candidate_name      VARCHAR(200) NOT NULL,
    candidate_email     VARCHAR(320),
    interview_id        UUID REFERENCES interviews(interview_id),
    overall_score       NUMERIC(5,2),
    status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','expired')),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_recruiter ON assessments(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessments_token ON assessments(share_token);
CREATE INDEX IF NOT EXISTS idx_a_submissions_assessment ON assessment_submissions(assessment_id);
