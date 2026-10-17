import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { InterviewService } from './interview.service';
import { z } from 'zod';

const router = Router();
const service = new InterviewService();

const StartInterviewSchema = z.object({
    topic: z.string().min(1).max(100),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    num_questions: z.number().int().min(1).max(10).default(5),
});

const SubmitAnswerSchema = z.object({
    interview_id: z.string().uuid(),
    question_id: z.string().uuid(),
    answer_text: z.string().min(5).max(5000),
    answer_duration_seconds: z.number().int().min(0).max(600).default(0),
});

// POST /api/interviews/start
router.post('/start', authMiddleware, validate(StartInterviewSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.startInterview(req.user!.user_id, req.body);
        res.status(201).json({
            success: true,
            data: {
                interview_id: result.interview.interview_id,
                status: result.interview.status,
                questions: result.questions,
                started_at: result.interview.started_at,
                expires_at: result.interview.expires_at,
            },
        });
    } catch (err) { next(err); }
});

// POST /api/interviews/submit-answer
router.post('/submit-answer', authMiddleware, validate(SubmitAnswerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.submitAnswer(req.user!.user_id, req.body);
        res.status(202).json({
            success: true,
            data: {
                response_id: result.response_id,
                status: result.status,
                message: 'Answer received. AI feedback is being generated.',
                estimated_feedback_ms: 5000,
            },
        });
    } catch (err) { next(err); }
});

// POST /api/interviews/:id/complete
router.post('/:id/complete', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await service.completeInterview(req.user!.user_id, req.params.id);
        res.status(200).json({ success: true, message: 'Interview completed successfully' });
    } catch (err) { next(err); }
});

// GET /api/interviews/:id/results
router.get('/:id/results', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await service.getResults(req.user!.user_id, req.params.id);
        res.status(200).json({ success: true, data: results });
    } catch (err) { next(err); }
});

export default router;
