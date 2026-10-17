import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool;

export function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            min: parseInt(process.env.DB_POOL_MIN || '2'),
            max: parseInt(process.env.DB_POOL_MAX || '20'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            logger.error('Unexpected PostgreSQL pool error', { error: err.message });
        });
    }
    return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
        const result = await getPool().query(sql, params);
        const duration = Date.now() - start;
        if (duration > 500) {
            logger.warn('Slow query detected', { sql: sql.substring(0, 100), duration });
        }
        return result.rows as T[];
    } catch (err: any) {
        logger.error('Database query error', { sql: sql.substring(0, 100), error: err.message });
        throw err;
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params);
    return rows[0] ?? null;
}

export async function withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function testConnection(): Promise<void> {
    const rows = await query<{ now: Date }>('SELECT NOW()');
    logger.info('Database connected', { timestamp: rows[0].now });
}
