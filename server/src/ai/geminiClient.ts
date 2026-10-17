import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { getMockFeedback, isMockMode } from './mockResponses';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000];

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

export async function callGeminiWithRetry(prompt: string): Promise<string> {
    // ── MOCK MODE ────────────────────────────────────────────────────────────
    // If no real API key is configured, return sample feedback so the app
    // runs fully without a Gemini subscription.
    if (isMockMode()) {
        const mockFeedback = await getMockFeedback();
        return JSON.stringify(mockFeedback);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 1024,
        },
    });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            logger.info('Calling Gemini API', { attempt: attempt + 1 });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            logger.info('Gemini API responded', { chars: text.length });
            return text;
        } catch (err: any) {
            const status = err?.status || err?.code;
            const isRetryable = status === 429 || (status >= 500 && status < 600);
            logger.warn('Gemini API error', { attempt: attempt + 1, status, message: err.message });

            if (isRetryable && attempt < MAX_RETRIES - 1) {
                await sleep(RETRY_DELAYS[attempt]);
                continue;
            }
            throw err;
        }
    }
    throw new Error('Gemini API max retries exceeded');
}
