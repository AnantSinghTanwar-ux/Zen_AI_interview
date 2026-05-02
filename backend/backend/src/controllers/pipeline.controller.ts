import { Request, Response, NextFunction } from 'express';
import { PipelineService } from '../services/pipeline.service';
import { sendSuccess } from '../utils/response';
import { ApplicationStatus } from '../models/application.model';

export const PipelineController = {
  async getBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.jobId as string;
      const data = await PipelineService.getPipelineBoard(req.user!.userId, jobId);
      sendSuccess(res, data, 'Pipeline board retrieved');
    } catch (error) {
      next(error);
    }
  },

  async moveStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidateId, jobId, toStage, note } = req.body;
      const data = await PipelineService.moveCandidateStage(
        req.user!.userId,
        candidateId as string,
        jobId as string,
        toStage as ApplicationStatus,
        note as string
      );
      sendSuccess(res, data, 'Candidate moved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const candidateId = req.params.candidateId as string;
      const jobId = req.params.jobId as string;
      const history = await PipelineService.getCandidateHistory(req.user!.userId, candidateId, jobId);
      sendSuccess(res, history, 'Pipeline history retrieved');
    } catch (error) {
      next(error);
    }
  }
};
