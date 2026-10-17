import { query, queryOne, withTransaction } from '../../config/database';
import { Interview, Response as InterviewResponse } from '../../types';
import { PoolClient } from 'pg';

export class InterviewRepository {
    async startInterview(data: {
        user_id: string;
        topic: string;
        difficulty: string;
        num_questions: number;
    }): Promise<{ interview: Interview; questions: any[] }> {
        return withTransaction(async (client: PoolClient) => {
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            const iResult = await client.query(
                `INSERT INTO interviews (user_id, topic, difficulty, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
                [data.user_id, data.topic, data.difficulty, expiresAt]
            );
            const interview: Interview = iResult.rows[0];

            const qResult = await client.query(
                `SELECT question_id, text, topic, difficulty, estimated_time_sec
         FROM questions
         WHERE topic = $1 AND difficulty = $2 AND is_active = TRUE
         ORDER BY RANDOM()
         LIMIT $3`,
                [data.topic, data.difficulty, data.num_questions]
            );
            const questions = qResult.rows.map((q, idx) => ({ ...q, order: idx + 1 }));

            return { interview, questions };
        });
    }

    async findInterviewByIdAndUser(interview_id: string, user_id: string): Promise<Interview | null> {
        return queryOne<Interview>(
            `SELECT * FROM interviews WHERE interview_id = $1 AND user_id = $2`,
            [interview_id, user_id]
        );
    }

    async saveResponse(data: {
        interview_id: string;
        question_id: string;
        answer_text: string;
        duration_seconds: number;
    }): Promise<InterviewResponse> {
        const rows = await query<InterviewResponse>(
            `INSERT INTO responses (interview_id, question_id, answer_text, duration_seconds)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (interview_id, question_id) DO UPDATE
         SET answer_text = EXCLUDED.answer_text,
             duration_seconds = EXCLUDED.duration_seconds
       RETURNING *`,
            [data.interview_id, data.question_id, data.answer_text, data.duration_seconds]
        );
        return rows[0];
    }

    async updateResponseWithFeedback(
        response_id: string,
        score: number,
        ai_feedback: object
    ): Promise<void> {
        await query(
            `UPDATE responses
       SET score = $1, ai_feedback = $2, ai_processed_at = NOW()
       WHERE response_id = $3`,
            [score, JSON.stringify(ai_feedback), response_id]
        );
    }

    async completeInterview(interview_id: string): Promise<void> {
        await query(
            `UPDATE interviews
       SET status = 'completed',
           completed_at = NOW(),
           overall_score = (
             SELECT ROUND(AVG(score)::numeric, 2) FROM responses WHERE interview_id = $1
           )
       WHERE interview_id = $1`,
            [interview_id]
        );
    }

    async getInterviewResults(interview_id: string, user_id: string): Promise<any | null> {
        const interview = await queryOne<any>(
            `SELECT interview_id, topic, difficulty, status, overall_score, started_at, completed_at
       FROM interviews WHERE interview_id = $1 AND user_id = $2`,
            [interview_id, user_id]
        );
        if (!interview) return null;

        const responses = await query<any>(
            `SELECT r.response_id, r.answer_text, r.score, r.ai_feedback, r.duration_seconds,
              q.question_id, q.text AS question_text, q.topic AS question_topic
       FROM responses r
       JOIN questions q ON r.question_id = q.question_id
       WHERE r.interview_id = $1
       ORDER BY r.created_at ASC`,
            [interview_id]
        );

        return { ...interview, responses };
    }
}
