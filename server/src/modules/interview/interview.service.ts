import { InterviewRepository } from './interview.repository';
import { AppError } from '../../middleware/errorHandler';
import { buildFeedbackPrompt } from '../../ai/promptBuilder';
import { callGeminiWithRetry } from '../../ai/geminiClient';
import { parseGeminiResponse } from '../../ai/responseParser';
import { UserRepository } from '../user/user.repository';
import { logger } from '../../utils/logger';

const repo = new InterviewRepository();
const userRepo = new UserRepository();

export class InterviewService {
    async startInterview(user_id: string, data: {
        topic: string;
        difficulty: string;
        num_questions: number;
    }) {
        const { interview, questions } = await repo.startInterview({ user_id, ...data });
        return { interview, questions };
    }

    async submitAnswer(user_id: string, data: {
        interview_id: string;
        question_id: string;
        answer_text: string;
        answer_duration_seconds: number;
    }) {
        const interview = await repo.findInterviewByIdAndUser(data.interview_id, user_id);
        if (!interview) {
            throw new AppError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
        }
        if (interview.status !== 'in_progress') {
            throw new AppError(409, 'Interview is no longer active', 'INTERVIEW_NOT_ACTIVE');
        }
        if (interview.expires_at && new Date(interview.expires_at) < new Date()) {
            await repo.completeInterview(data.interview_id);
            throw new AppError(410, 'Interview session has expired', 'INTERVIEW_EXPIRED');
        }
        if (!data.answer_text || data.answer_text.trim().length < 5) {
            throw new AppError(422, 'Answer is too short', 'ANSWER_TOO_SHORT');
        }

        const saved = await repo.saveResponse({
            interview_id: data.interview_id,
            question_id: data.question_id,
            answer_text: data.answer_text.trim(),
            duration_seconds: data.answer_duration_seconds,
        });

        // Process AI feedback asynchronously (non-blocking)
        this.processAiFeedback(saved.response_id, interview, data).catch((err) => {
            logger.error('AI feedback processing failed', { response_id: saved.response_id, error: err.message });
        });

        return { response_id: saved.response_id, status: 'processing' };
    }

    private async processAiFeedback(
        response_id: string,
        interview: any,
        data: { question_id: string; answer_text: string }
    ): Promise<void> {
        // Fetch the question text
        const { query } = await import('../../config/database');
        const [question] = await query<any>(`SELECT text FROM questions WHERE question_id = $1`, [data.question_id]);
        if (!question) return;

        const prompt = buildFeedbackPrompt(
            question.text,
            interview.topic,
            interview.difficulty,
            data.answer_text
        );

        const raw = await callGeminiWithRetry(prompt);
        const feedback = parseGeminiResponse(raw);

        await repo.updateResponseWithFeedback(response_id, feedback.score, feedback);
        logger.info('AI feedback stored', { response_id, score: feedback.score });
    }

    async getResults(user_id: string, interview_id: string) {
        const results = await repo.getInterviewResults(interview_id, user_id);
        if (!results) {
            throw new AppError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
        }
        return results;
    }

    async completeInterview(user_id: string, interview_id: string): Promise<void> {
        const interview = await repo.findInterviewByIdAndUser(interview_id, user_id);
        if (!interview) throw new AppError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
        if (interview.status === 'completed') return;

        await repo.completeInterview(interview_id);
        await userRepo.invalidateDashboardCache(user_id);
    }
}
