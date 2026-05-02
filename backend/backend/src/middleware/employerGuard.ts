// src/middleware/employerGuard.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export const employerGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    // 1. Ensure user exists (should already be handled by authenticate)
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // 2. Explicit role gate keeps non-recruiters from touching recruiter-only endpoints.
    if (user.role !== 'recruiter') {
      res.status(403).json({
        success: false,
        message: 'Only recruiters allowed',
      });
      return;
    }

    // 3. Load recruiter profile. We keep this DB lookup in middleware so downstream
    // handlers can rely on a fully-initialized recruiter context.
    const recruiterProfile = await prisma.recruiter_profiles.findUnique({
      where: {
        user_id: user.userId, // comes from JWT payload
      },
    });

    // 4. Self-heal recruiter profile if row is missing (legacy OAuth/local accounts).
    if (!recruiterProfile) {
      const created = await prisma.recruiter_profiles.create({
        data: { user_id: user.userId },
      });

      req.employer = created as unknown as any;
      next();
      return;
    }

    // 5. Attach recruiter profile for downstream controllers/services.
    req.employer = recruiterProfile as unknown as any;

    // 6. Continue request pipeline.
    next();
  } catch (error) {
    console.error('Employer Guard Error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};