import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, ForbiddenError } from '../utils/errors';

export const MessageController = {
  async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const conversations = await MessageService.getConversations(req.user!.userId, req.user!.role);
      sendSuccess(res, conversations);
    } catch (err) {
      next(err);
    }
  },

  async startConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicantId, recipientId, jobId } = req.body as {
        applicantId?: string;
        recipientId?: string;
        jobId?: string;
      };
      const requester = req.user!;

      if (requester.role !== 'recruiter' && requester.role !== 'admin') {
        throw new ForbiddenError('Only recruiters and admins can initiate conversations');
      }

      const targetApplicantId = applicantId || recipientId;
      if (!targetApplicantId) {
        throw new BadRequestError('recipientId or applicantId is required', 'RECIPIENT_REQUIRED');
      }
      if (targetApplicantId === requester.userId) {
        throw new BadRequestError('You cannot message yourself', 'SELF_MESSAGE_NOT_ALLOWED');
      }

      let recruiterId = requester.userId;
      const finalApplicantId = targetApplicantId;

      if (requester.role === 'admin') {
        if (!jobId) {
          throw new BadRequestError('jobId is required for admin messaging', 'JOB_REQUIRED_FOR_ADMIN');
        }

        const job = await MessageService.getJobMessagingContext(jobId);
        const isAdminOwnedSource =
          (job.source === 'admin_external' || job.source === 'admin_company') &&
          job.created_by === requester.userId;

        if (!isAdminOwnedSource) {
          throw new ForbiddenError(
            'Admins can message applicants only for jobs they posted',
            'ADMIN_JOB_MESSAGING_FORBIDDEN',
          );
        }

        await MessageService.assertApplicantAppliedToJob(finalApplicantId, jobId);
        recruiterId = job.recruiter_id;
      }

      const conversation = await MessageService.getOrCreateConversation(
        recruiterId,
        finalApplicantId,
        jobId,
      );
      sendSuccess(res, conversation, 'Conversation started', 201);
    } catch (err) {
      next(err);
    }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const messages = await MessageService.getMessages(
        req.params.conversationId as string,
        req.user!,
        page,
        50,
      );
      sendSuccess(res, { messages });
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { body, content } = req.body as { body?: string; content?: string };
      const messageBody = typeof content === 'string' ? content : body;
      const message = await MessageService.sendMessage(
        req.params.conversationId as string,
        req.user!,
        messageBody || '',
      );
      sendSuccess(res, { message }, 'Message sent', 201);
    } catch (err) {
      next(err);
    }
  },
};
