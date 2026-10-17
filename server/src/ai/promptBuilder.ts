/**
 * Builds a structured prompt for Google Gemini to evaluate an interview answer.
 * Low temperature + JSON mode is used for deterministic output.
 */
export function buildFeedbackPrompt(
    question: string,
    topic: string,
    difficulty: string,
    userAnswer: string
): string {
    return `
You are an expert technical interviewer and communication coach conducting a ${difficulty}-level ${topic} interview.

QUESTION ASKED:
"${question}"

CANDIDATE'S ANSWER:
"${userAnswer}"

Evaluate the answer strictly and constructively.

Respond ONLY with a valid JSON object matching this exact schema — no markdown fences, no extra text:
{
  "score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "relevance_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "strengths": [<string>, <string>],
  "improvements": [<string>, <string>],
  "model_answer_hint": "<2-3 sentences on what a perfect answer includes>",
  "detected_keywords": [<string>],
  "overall_verdict": "excellent" | "good" | "needs_improvement" | "poor"
}

Scoring rubric:
- 90-100: Exceptional — structured, STAR method used, quantified outcomes
- 70-89: Good — mostly complete with minor gaps
- 50-69: Acceptable — lacks depth or specific examples
- 0-49: Vague, off-topic, or significantly incomplete

IMPORTANT: Return ONLY the JSON object. No preamble, no explanation.
  `.trim();
}
