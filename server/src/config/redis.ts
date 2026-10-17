import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
    if (!redisClient) {
        try {
            redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 3000,
                retryStrategy(times) {
                    if (times > 3) {
                        redisAvailable = false;
                        return null; // Stop retrying — degrade gracefully
                    }
                    return Math.min(times * 500, 2000);
                },
            });

            redisClient.on('connect', () => {
                redisAvailable = true;
                logger.info('Redis connected');
            });
            redisClient.on('error', (err) => {
                redisAvailable = false;
                logger.warn('Redis unavailable — caching disabled', { error: err.message });
            });
            redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

            // Attempt connection (non-blocking)
            redisClient.connect().catch(() => {
                redisAvailable = false;
                logger.warn('⚠️  Redis not reachable — server will run without cache');
            });
        } catch (err: any) {
            logger.warn('Redis init failed — cache disabled', { error: err.message });
        }
    }
    return redisClient;
}

export function isRedisAvailable(): boolean {
    return redisAvailable;
}

export async function setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!redisAvailable || !redisClient) return; // no-op if Redis is down
    try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
        // Silently degrade — cache miss is acceptable
    }
}

export async function getCache<T>(key: string): Promise<T | null> {
    if (!redisAvailable || !redisClient) return null; // cache miss
    try {
        const raw = await redisClient.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function deleteCache(key: string): Promise<void> {
    if (!redisAvailable || !redisClient) return;
    try {
        await redisClient.del(key);
    } catch {
        // Silently ignore
    }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
    if (!redisAvailable || !redisClient) return;
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) await redisClient.del(...keys);
    } catch {
        // Silently ignore
    }
}
