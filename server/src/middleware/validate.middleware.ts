import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const parsed = schema.parse(req[target]);
            req[target] = parsed;
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const errors = err.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(422).json({ success: false, error: 'Validation failed', details: errors });
            } else {
                next(err);
            }
        }
    };
}
