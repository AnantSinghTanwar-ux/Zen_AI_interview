import { randomBytes } from 'crypto';

export const generateReferralCode = (): string => randomBytes(5).toString('hex').toUpperCase(); // e.g. "A3F9C2B1D0"
