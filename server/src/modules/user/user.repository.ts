import { query, queryOne } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';

export class UserRepository {
    async getDashboard(user_id: string) {
        // Try cache first
        const cacheKey = `dashboard:${user_id}`;
        const cached = await getCache<any>(cacheKey);
        if (cached) return cached;

        const [userRow, stats, recentInterviews, trend] = await Promise.all([
            queryOne<any>(
                `SELECT user_id, full_name, email, created_at FROM users WHERE user_id = $1`,
                [user_id]
            ),
            queryOne<any>(
                `SELECT COUNT(*)::int AS total_interviews,
                ROUND(AVG(overall_score)::numeric, 1) AS avg_score
         FROM interviews
         WHERE user_id = $1 AND status = 'completed'`,
                [user_id]
            ),
            query<any>(
                `SELECT i.interview_id, i.topic, i.overall_score AS score,
                i.started_at AS conducted_at, i.status
         FROM interviews i
         WHERE i.user_id = $1
         ORDER BY i.started_at DESC LIMIT 5`,
                [user_id]
            ),
            query<any>(
                `SELECT DATE(started_at) AS date,
                ROUND(AVG(overall_score)::numeric) AS score
         FROM interviews
         WHERE user_id = $1 AND status = 'completed'
           AND started_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(started_at)
         ORDER BY date ASC`,
                [user_id]
            ),
        ]);

        const result = {
            user: {
                user_id: userRow?.user_id,
                full_name: userRow?.full_name,
                email: userRow?.email,
                total_interviews: stats?.total_interviews || 0,
                avg_score: stats?.avg_score || 0,
            },
            recent_interviews: recentInterviews,
            performance_trend: trend,
        };

        await setCache(cacheKey, result, 300); // Cache for 5 min
        return result;
    }

    async invalidateDashboardCache(user_id: string): Promise<void> {
        await deleteCache(`dashboard:${user_id}`);
    }
}
