import { AiFeedback } from '../types';
import { logger } from '../utils/logger';

/**
 * MOCK MODE — used when GEMINI_API_KEY is not set.
 * Returns realistic-looking AI feedback so the full app
 * can be run and tested without an API key.
 */

const MOCK_RESPONSES: AiFeedback[] = [
    {
        score: 82,
        communication_score: 85,
        relevance_score: 80,
        confidence_score: 80,
        strengths: [
            'Clearly structured response using the STAR method',
            'Demonstrated strong ownership and accountability',
            'Good use of specific technical terminology',
        ],
        improvements: [
            'Quantify the impact of your actions with metrics (e.g., "reduced time by 30%")',
            'Mention what you learned or would do differently next time',
        ],
        model_answer_hint:
            'Strong answers define the situation briefly, explain YOUR specific actions (not the team\'s), and always end with a measurable outcome and a reflection.',
        detected_keywords: ['teamwork', 'problem-solving', 'communication', 'deadline'],
        overall_verdict: 'good',
    },
    {
        score: 65,
        communication_score: 70,
        relevance_score: 60,
        confidence_score: 65,
        strengths: [
            'Showed genuine enthusiasm for the subject',
            'Mentioned relevant past experience',
        ],
        improvements: [
            'Answer was too general — use a specific real-world example',
            'Structure your response more clearly with a beginning, middle, and end',
            'Add measurable outcomes to demonstrate true impact',
        ],
        model_answer_hint:
            'Use the STAR framework (Situation, Task, Action, Result). Be specific about your individual contribution rather than what the team did.',
        detected_keywords: ['experience', 'project', 'team'],
        overall_verdict: 'needs_improvement',
    },
    {
        score: 91,
        communication_score: 93,
        relevance_score: 90,
        confidence_score: 90,
        strengths: [
            'Excellent structure — clear situation, precise actions, and quantified result',
            'Showed self-awareness and ability to adapt under pressure',
            'Used industry-relevant vocabulary effectively',
        ],
        improvements: [
            'Could briefly mention what you would do differently in hindsight',
        ],
        model_answer_hint:
            'Your answer is very strong. To make it perfect, add a brief reflection on what this experience taught you and how it changed your approach going forward.',
        detected_keywords: ['leadership', 'data-driven', 'outcome', 'stakeholders', 'scalability'],
        overall_verdict: 'excellent',
    },
    {
        score: 48,
        communication_score: 55,
        relevance_score: 42,
        confidence_score: 46,
        strengths: [
            'Attempted to address the question',
        ],
        improvements: [
            'The answer did not directly address what was asked — stay on topic',
            'Include a real example from your experience',
            'Avoid filler phrases; be direct and concise',
            'Use the STAR method to add structure to your response',
        ],
        model_answer_hint:
            'Re-read the question carefully and answer it directly. Use a concrete example and explain YOUR role, not the team\'s. End with the result and what you learned.',
        detected_keywords: [],
        overall_verdict: 'poor',
    },
    {
        score: 75,
        communication_score: 78,
        relevance_score: 74,
        confidence_score: 73,
        strengths: [
            'Good understanding of the core concept',
            'Logical and easy to follow explanation',
        ],
        improvements: [
            'Add a real-world example to make it more convincing',
            'Expand on trade-offs or limitations of your approach',
        ],
        model_answer_hint:
            'Good technical answers always cover: what it is, why it matters, and when to use it (vs. alternatives). Include a concrete example or analogy.',
        detected_keywords: ['algorithm', 'complexity', 'trade-off', 'approach'],
        overall_verdict: 'good',
    },
];

let mockIndex = 0;

/**
 * Returns the next mock feedback in a round-robin cycle.
 * Simulates ~800ms of "AI processing" delay.
 */
export async function getMockFeedback(): Promise<AiFeedback> {
    logger.warn('⚠️  MOCK MODE: Returning sample AI feedback (no GEMINI_API_KEY set)');
    // Simulate realistic AI latency
    await new Promise((r) => setTimeout(r, 800));
    const feedback = MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length];
    mockIndex++;
    return feedback;
}

export function isMockMode(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !key || key === '' || key.startsWith('your_gemini') || key === 'MOCK';
}
