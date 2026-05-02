import { Router } from 'express';
import { body } from 'express-validator';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { requireEmail } from '../middleware/requireEmail';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, requireEmail);

router.get('/conversations', MessageController.getConversations);

router.post(
  '/conversations',
  body('recipientId').optional().isUUID(),
  body('applicantId').optional().isUUID(),
  body('jobId').optional().isUUID(),
  body().custom((value) => {
    const hasRecipientId = typeof value?.recipientId === 'string' && value.recipientId.length > 0;
    const hasApplicantId = typeof value?.applicantId === 'string' && value.applicantId.length > 0;

    if (!hasRecipientId && !hasApplicantId) {
      throw new Error('recipientId or applicantId is required');
    }

    return true;
  }),
  validate,
  MessageController.startConversation,
);

router.get('/conversations/:conversationId', MessageController.getMessages);

router.get('/:conversationId', MessageController.getMessages);

router.post(
  '/conversations/:conversationId',
  body('body').optional().isString().trim(),
  body('content').optional().isString().trim(),
  body().custom((value) => {
    const hasBody = typeof value?.body === 'string' && value.body.trim().length > 0;
    const hasContent = typeof value?.content === 'string' && value.content.trim().length > 0;
    if (!hasBody && !hasContent) {
      throw new Error('body or content is required');
    }
    return true;
  }),
  validate,
  MessageController.sendMessage,
);

router.post(
  '/:conversationId',
  body('body').optional().isString().trim(),
  body('content').optional().isString().trim(),
  body().custom((value) => {
    const hasBody = typeof value?.body === 'string' && value.body.trim().length > 0;
    const hasContent = typeof value?.content === 'string' && value.content.trim().length > 0;
    if (!hasBody && !hasContent) {
      throw new Error('body or content is required');
    }
    return true;
  }),
  validate,
  MessageController.sendMessage,
);

export default router;
