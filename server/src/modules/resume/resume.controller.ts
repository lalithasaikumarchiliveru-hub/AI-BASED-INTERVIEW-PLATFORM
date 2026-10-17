import { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class ResumeController {
    /** POST /api/resume/upload — multipart/form-data with 'resume' file */
    async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const file = (req as any).file;
            if (!file) throw new AppError(400, 'No file uploaded', 'NO_FILE');
            if (file.size > 5 * 1024 * 1024) throw new AppError(400, 'File too large (max 5MB)', 'FILE_TOO_LARGE');

            const allowedTypes = ['application/pdf', 'text/plain', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.mimetype)) {
                throw new AppError(400, 'Unsupported file type. Upload a PDF, DOCX, or TXT file.', 'INVALID_FILE_TYPE');
            }

            // Extract text from buffer
            let extractedText = '';
            if (file.mimetype === 'text/plain') {
                extractedText = file.buffer.toString('utf-8');
            } else if (file.mimetype === 'application/pdf') {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
                    const parsed = await pdfParse(file.buffer);
                    extractedText = parsed.text;
                } catch {
                    extractedText = '[PDF text extraction failed — please upload a text-based PDF]';
                }
            } else {
                extractedText = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ');
            }

            // AI analysis — extract skills and suggested topics
            const analysis = await analyseResumeWithAI(extractedText);

            // Deactivate previous resumes
            await query(`UPDATE user_resumes SET is_active = FALSE WHERE user_id = $1`, [req.user!.user_id]);

            // Store new resume
            const [newResume] = await query<{ resume_id: string }>(
                `INSERT INTO user_resumes (user_id, filename, file_size_bytes, extracted_text, skills_json, topics_json, summary_text)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING resume_id`,
                [req.user!.user_id, file.originalname, file.size,
                extractedText.slice(0, 50000), // cap to 50k chars
                JSON.stringify(analysis.skills),
                JSON.stringify(analysis.topics),
                analysis.summary]
            );

            logger.info('Resume uploaded', { user_id: req.user!.user_id, filename: file.originalname });
            res.status(201).json({ success: true, data: { resume_id: newResume.resume_id, ...analysis } });
        } catch (err) { next(err); }
    }

    /** GET /api/resume/current */
    async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const resume = await queryOne(
                `SELECT resume_id, filename, skills_json, topics_json, summary_text, created_at
                 FROM user_resumes WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
                [req.user!.user_id]
            );
            res.json({ success: true, data: resume || null });
        } catch (err) { next(err); }
    }

    /** POST /api/resume/jd-match — match resume against a job description */
    async jdMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { jd_text, resume_id } = req.body;
            if (!jd_text || jd_text.trim().length < 30) {
                throw new AppError(400, 'Please provide a full job description (min 30 characters)', 'JD_TOO_SHORT');
            }

            // Get resume text
            let resumeText = '';
            if (resume_id) {
                const r = await queryOne<{ extracted_text: string }>(
                    `SELECT extracted_text FROM user_resumes WHERE resume_id = $1 AND user_id = $2`, [resume_id, req.user!.user_id]
                );
                resumeText = r?.extracted_text || '';
            } else {
                const r = await queryOne<{ extracted_text: string }>(
                    `SELECT extracted_text FROM user_resumes WHERE user_id = $1 AND is_active = TRUE LIMIT 1`, [req.user!.user_id]
                );
                resumeText = r?.extracted_text || '';
            }

            if (!resumeText) throw new AppError(400, 'No resume found. Please upload your resume first.', 'NO_RESUME');

            const result = await matchJDWithAI(resumeText, jd_text);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    }
}

async function analyseResumeWithAI(resumeText: string): Promise<{
    skills: string[]; topics: string[]; summary: string;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Analyse this resume and return ONLY a valid JSON object (no markdown) with these keys:
- skills: array of up to 20 technical and soft skills found in the resume
- topics: array of 4-6 interview topic areas to focus on (e.g. "System Design", "Behavioural", "Python", "DSA")
- summary: 2-3 sentence professional summary of the candidate

Resume:
${resumeText.slice(0, 8000)}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch {
        return {
            skills: ['Communication', 'Problem Solving', 'Teamwork'],
            topics: ['Behavioural', 'Technical', 'Situational'],
            summary: 'Resume uploaded successfully. AI analysis unavailable — please check your Gemini API key.',
        };
    }
}

async function matchJDWithAI(resumeText: string, jdText: string): Promise<{
    match_score: number;
    matched_skills: string[];
    missing_skills: string[];
    practice_questions: string[];
    verdict: string;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Compare this resume against the job description and return ONLY a valid JSON object (no markdown):
{
  "match_score": <integer 0-100>,
  "matched_skills": [<skills from resume that match JD, max 10>],
  "missing_skills": [<skills in JD not evident in resume, max 8>],
  "practice_questions": [<5 interview questions tailored to this JD>],
  "verdict": "<1 sentence overall assessment>"
}

RESUME:
${resumeText.slice(0, 5000)}

JOB DESCRIPTION:
${jdText.slice(0, 3000)}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch {
        return { match_score: 0, matched_skills: [], missing_skills: [], practice_questions: [], verdict: 'Analysis failed.' };
    }
}
