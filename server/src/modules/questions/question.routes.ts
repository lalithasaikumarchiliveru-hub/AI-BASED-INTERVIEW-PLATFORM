import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import { query } from '../../config/database';
import { getCache, setCache } from '../../config/redis';

const router = Router();

const QuestionsQuerySchema = z.object({
    topic: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/questions
router.get('/', authMiddleware, validate(QuestionsQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { topic, difficulty, limit, offset } = req.query as any;

        const cacheKey = `questions:${topic || 'all'}:${difficulty || 'all'}:${limit}:${offset}`;
        const cached = await getCache<any>(cacheKey);
        if (cached) {
            res.status(200).json({ success: true, data: cached, cached: true });
            return;
        }

        const conditions: string[] = ['is_active = TRUE'];
        const params: any[] = [];
        let idx = 1;

        if (topic) { conditions.push(`topic = $${idx++}`); params.push(topic); }
        if (difficulty) { conditions.push(`difficulty = $${idx++}`); params.push(difficulty); }

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const [questions, countResult] = await Promise.all([
            query<any>(
                `SELECT question_id, text, topic, difficulty, tags, estimated_time_sec
         FROM questions ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
                [...params, limit, offset]
            ),
            query<any>(`SELECT COUNT(*)::int AS total FROM questions ${whereClause}`, params),
        ]);

        const total = countResult[0]?.total || 0;
        const result = {
            questions,
            pagination: { total, limit: +limit, offset: +offset, has_more: +offset + +limit < total },
        };

        await setCache(cacheKey, result, 3600); // 1-hour cache
        res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
});

export default router;
