import type { RecruiterProfile } from '../models/recruiterProfile.model';

export type UserRole = 'applicant' | 'recruiter' | 'admin';

export interface JwtPayload {
  userId: string;
  email: string | null;
  role: UserRole;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      employer?: RecruiterProfile;
    }
  }
}
