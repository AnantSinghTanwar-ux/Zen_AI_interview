import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storage.service';
import { sendSuccess } from '../utils/response';

export const UploadController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const result = await StorageService.uploadAny(req.file);
      sendSuccess(res, { url: result.url }, 'Upload successful');
    } catch (err) {
      next(err);
    }
  },
};
