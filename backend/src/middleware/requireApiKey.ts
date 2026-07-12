import type { NextFunction, Request, Response } from 'express';

export const requireApiKey = (expected: string) => (req: Request, res: Response, next: NextFunction): void => {
  if (req.header('x-api-key') !== expected) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  next();
};
