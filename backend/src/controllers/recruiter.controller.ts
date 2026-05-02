import { Request, Response, NextFunction } from 'express';
import { RecruiterService } from '../services/recruiter.service';
import { sendSuccess } from '../utils/response';

export const RecruiterController = {
  async getRecruiterProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // req.employer is pre-loaded by employerGuard middleware
      // No database query needed
      const profile = req.employer!;
      sendSuccess(res, profile, 'Recruiter profile fetched successfully', 200);
    } catch (err) {
      next(err);
    }
  },

  async updateRecruiterProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if body is empty (no fields to update)
      if (!req.body || Object.keys(req.body).length === 0) {
        res.status(400).json({ success: false, message: 'No fields provided for update' });
        return;
      }

      const userId = req.user!.userId;
      const updateData = req.body;

      const profile = await RecruiterService.updateRecruiterProfile(userId, updateData);
      sendSuccess(res, profile, 'Recruiter profile updated successfully', 200);
    } catch (err) {
      next(err);
    }
  },

  async createRecruiterProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { company_name, company_email, industry, description, company_size, website, location } = req.body;

      const profile = await RecruiterService.createRecruiterProfile(userId, {
        company_name,
        company_email,
        industry,
        description,
        company_size,
        website,
        location,
      });

      sendSuccess(res, profile, 'Recruiter profile created successfully', 201);
    } catch (err) {
      next(err);
    }
  },


};
