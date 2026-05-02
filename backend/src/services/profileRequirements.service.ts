import { ApplicantProfileModel } from '../models/applicantProfile.model';
import { RecruiterProfileModel } from '../models/recruiterProfile.model';
import { UserModel } from '../models/user.model';

const normalize = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '');

const isValidEmail = (email: string): boolean => {
  // Keep validation intentionally permissive but non-empty and shape-checked.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone: string): boolean => {
  // Accept common international/local digits with optional separators.
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
};

export const ProfileRequirementsService = {
  async assertApplicantCanApply(userId: string): Promise<void> {
    const [user, profile] = await Promise.all([
      UserModel.findById(userId),
      ApplicantProfileModel.findByUserId(userId),
    ]);

    const missing: string[] = [];

    const fullName = normalize(profile?.name);
    if (!fullName) {
      missing.push('Full Name');
    }

    const email = normalize(user?.email);
    if (!email || !isValidEmail(email)) {
      missing.push('Email');
    }

    const phone = normalize(profile?.phone);
    if (!phone || !isValidPhone(phone)) {
      missing.push('Phone Number');
    }

    if (missing.length > 0) {
      throw Object.assign(
        new Error(`Complete required profile fields before applying: ${missing.join(', ')}`),
        {
          statusCode: 422,
          code: 'APPLICANT_PROFILE_INCOMPLETE',
          missingFields: missing,
        },
      );
    }
  },

  async assertRecruiterCanPostJob(userId: string): Promise<void> {
    const [user, profile] = await Promise.all([
      UserModel.findById(userId),
      RecruiterProfileModel.findByUserId(userId),
    ]);

    const missing: string[] = [];

    const recruiterName = normalize(profile?.name);
    if (!recruiterName) {
      missing.push('Your Name');
    }

    const email = normalize(user?.email);
    if (!email || !isValidEmail(email)) {
      missing.push('Email');
    }

    const companyName = normalize(profile?.company_name);
    if (!companyName) {
      missing.push('Company Name');
    }

    const industry = normalize(profile?.industry);
    if (!industry) {
      missing.push('Industry');
    }

    if (missing.length > 0) {
      throw Object.assign(
        new Error(`Complete required recruiter profile fields before posting jobs: ${missing.join(', ')}`),
        {
          statusCode: 422,
          code: 'RECRUITER_PROFILE_INCOMPLETE',
          missingFields: missing,
        },
      );
    }
  },
};
