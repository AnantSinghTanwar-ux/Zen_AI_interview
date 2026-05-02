import { MessageModel } from '../models/message.model';
import { NotificationModel } from '../models/notification.model';
import { emitMessage, emitNotification } from '../config/socket';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { JwtPayload } from '../types';

export const MessageService = {
  async getConversations(userId: string, role: string) {
    return MessageModel.getConversationsForUser(userId, role);
  },

  async getOrCreateConversation(recruiterId: string, applicantId: string, jobId?: string) {
    return MessageModel.findOrCreateConversation(recruiterId, applicantId, jobId);
  },

  async getJobMessagingContext(jobId: string) {
    const job = await MessageModel.getJobMessagingContext(jobId);
    if (!job) {
      throw new NotFoundError('Job not found', 'JOB_NOT_FOUND');
    }
    return job;
  },

  async assertApplicantAppliedToJob(applicantId: string, jobId: string) {
    const hasApplied = await MessageModel.hasApplicantAppliedToJob(applicantId, jobId);
    if (!hasApplied) {
      throw new ForbiddenError(
        'You can only message applicants who applied to this job',
        'APPLICANT_NOT_APPLIED_TO_JOB',
      );
    }
  },

  async getConversationForUser(conversationId: string, user: JwtPayload) {
    const conversation = await MessageModel.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    const isParticipant =
      conversation.recruiter_id === user.userId || conversation.applicant_id === user.userId;

    if (!isParticipant) {
      const canAdminAccess =
        user.role === 'admin' &&
        conversation.job_id &&
        (await MessageModel.isAdminAllowedForConversation(user.userId, conversationId));

      if (!canAdminAccess) {
        throw new ForbiddenError('You are not part of this conversation', 'NOT_CONVERSATION_MEMBER');
      }
    }

    return conversation;
  },

  async getMessages(conversationId: string, user: JwtPayload, page: number, limit: number) {
    await MessageService.getConversationForUser(conversationId, user);
    return MessageModel.getMessages(conversationId, page, limit);
  },

  async sendMessage(conversationId: string, sender: JwtPayload, content: string) {
    const conversation = await MessageService.getConversationForUser(conversationId, sender);
    const body = String(content || '').trim();

    if (!body) {
      throw new BadRequestError('Message content is required', 'MESSAGE_REQUIRED');
    }

    const senderIsParticipant =
      sender.userId === conversation.recruiter_id || sender.userId === conversation.applicant_id;
    const actingAsCompany = sender.role === 'admin' && !senderIsParticipant;
    const persistedSenderId = actingAsCompany ? conversation.recruiter_id : sender.userId;

    const recipientId =
      persistedSenderId === conversation.recruiter_id
        ? conversation.applicant_id
        : conversation.recruiter_id;

    const message = await MessageModel.createMessage({
      conversation_id: conversationId,
      sender_id: persistedSenderId,
      body,
    });

    // Real-time delivery to conversation room
    emitMessage(conversationId, message);

    // Persist + real-time notification for recipient
    const notification = await NotificationModel.create({
      user_id: recipientId,
      type: 'new_message',
      title: 'New message',
      body: body.length > 60 ? body.substring(0, 60) + '…' : body,
      action_url: `/messages/${conversationId}`,
    });
    emitNotification(recipientId, notification);

    return message;
  },
};
