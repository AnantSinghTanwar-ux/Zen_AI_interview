import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export const NotificationController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { notifications, total, unread } = await NotificationService.getNotifications(
        req.user!.userId,
        page,
        limit,
      );
      res.json({
        success: true,
        data: notifications,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        unread,
      });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await NotificationService.markRead(req.user!.userId, req.params.id as string);
      sendSuccess(res, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAllRead(req.user!.userId);
      sendSuccess(res, null, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  },
};
