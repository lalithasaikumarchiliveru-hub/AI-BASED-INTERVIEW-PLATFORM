// Shared TypeScript types & interfaces for the entire application

export interface User {
    user_id: string;
    email: string;
    full_name: string;
    password_hash?: string;
    is_active: boolean;
    email_verified: boolean;
    email_verification_token?: string | null;
    email_verification_expires?: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface Question {
    question_id: string;
    text: string;
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    estimated_time_sec: number;
    is_active: boolean;
    created_at: Date;
}

export interface Interview {
    interview_id: string;
    user_id: string;
    topic: string;
    difficulty: string;
    status: 'in_progress' | 'completed' | 'abandoned' | 'expired';
    overall_score: number | null;
    started_at: Date;
    completed_at: Date | null;
    expires_at: Date | null;
    created_at: Date;
}

export interface AiFeedback {
    score: number;
    communication_score: number;
    relevance_score: number;
    confidence_score: number;
    strengths: string[];
    improvements: string[];
    model_answer_hint: string;
    detected_keywords: string[];
    overall_verdict: 'excellent' | 'good' | 'needs_improvement' | 'poor';
}

export interface Response {
    response_id: string;
    interview_id: string;
    question_id: string;
    answer_text: string;
    duration_seconds: number | null;
    score: number | null;
    ai_feedback: AiFeedback | null;
    ai_processed_at: Date | null;
    created_at: Date;
}

export interface JwtPayload {
    user_id: string;
    email: string;
    iat?: number;
    exp?: number;
}

export interface PaginationParams {
    limit: number;
    offset: number;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        has_more: boolean;
    };
}

// Express request extension
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
