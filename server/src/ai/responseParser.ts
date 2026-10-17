import { z } from 'zod';
import { AiFeedback } from '../types';

const AiFeedbackSchema = z.object({
    score: z.number().int().min(0).max(100),
    communication_score: z.number().int().min(0).max(100),
    relevance_score: z.number().int().min(0).max(100),
    confidence_score: z.number().int().min(0).max(100),
    strengths: z.array(z.string()).min(1).max(6),
    improvements: z.array(z.string()).min(1).max(6),
    model_answer_hint: z.string().min(10).max(600),
    detected_keywords: z.array(z.string()),
    overall_verdict: z.enum(['excellent', 'good', 'needs_improvement', 'poor']),
});

export function parseGeminiResponse(rawText: string): AiFeedback {
    // Strip markdown code fences if present (Gemini sometimes wraps JSON)
    const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        // Last-ditch: try to extract first JSON object
        const match = rawText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No valid JSON found in Gemini response');
        parsed = JSON.parse(match[0]);
    }

    return AiFeedbackSchema.parse(parsed);
}
