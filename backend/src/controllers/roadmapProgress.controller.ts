import { Request, Response, NextFunction } from 'express';
import { RoadmapProgressService } from '../services/roadmapProgress.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * GET /users/:userId/roadmaps/:roadmapId/progress
 * Returns user's roadmap progress with skill matching details.
 */
export const getUserProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, roadmapId } = req.params;

    if (!userId || !roadmapId) {
      return sendError(res, 'userId and roadmapId are required', 400);
    }

    const progress = await RoadmapProgressService.getUserRoadmapProgress(
      userId as string,
      roadmapId as string,
    );

    sendSuccess(res, progress, 'Roadmap progress retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/:userId/roadmaps/:roadmapId/recommend-next-skill
 * Returns the recommended next skill for a user to learn.
 */
export const getRecommendedNextSkill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, roadmapId } = req.params;

    if (!userId || !roadmapId) {
      return sendError(res, 'userId and roadmapId are required', 400);
    }

    const recommendation = await RoadmapProgressService.recommendNextSkill(
      userId as string,
      roadmapId as string,
    );

    if (!recommendation) {
      return sendSuccess(
        res,
        { completed: true, message: 'All roadmap nodes are already covered by your skills.' },
        'Roadmap fully completed',
      );
    }

    sendSuccess(res, recommendation, 'Next skill recommendation retrieved successfully');
  } catch (err) {
    next(err);
  }
};
