import { NotificationModel, NotificationType } from '../models/notification.model';
import { emitNotification } from '../config/socket';

export const NotificationService = {
  async getNotifications(userId: string, page: number, limit: number) {
    return NotificationModel.findByUser(userId, page, limit);
  },

  async markRead(userId: string, notificationId: string) {
    await NotificationModel.markRead(notificationId, userId);
  },

  async markAllRead(userId: string) {
    await NotificationModel.markAllRead(userId);
  },

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    actionUrl?: string,
  ) {
    const notification = await NotificationModel.create({
      user_id: userId,
      type,
      title,
      body,
      action_url: actionUrl,
    });
    emitNotification(userId, notification);
    return notification;
  },
};
