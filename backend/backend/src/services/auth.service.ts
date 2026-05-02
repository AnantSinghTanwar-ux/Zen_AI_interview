import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { UserModel } from '../models/user.model';
import { ReferralModel } from '../models/referral.model';
import { CreditService } from './credit.service';
import { ProfileBootstrapService } from './profileBootstrap.service';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import {
  sendEmail,
  verificationEmailHtml,
  passwordResetEmailHtml,
  oauthEmailVerificationHtml,
} from '../utils/email';
import { generateReferralCode } from '../utils/referralCode';
import { UserRole, JwtPayload } from '../types';
import prisma from '../config/prisma';
import logger from '../config/logger';
import redis from '../config/redis';
import { UnauthorizedError } from '../utils/errors';

const EMAIL_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const LOGOUT_REFRESH_PREFIX = 'auth:logout:refresh:';
const AUTO_VERIFY_EMAIL_ON_REGISTER = process.env.AUTO_VERIFY_EMAIL_ON_REGISTER !== 'false';

function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function timingSafeTokenMatch(hashedToken: string, storedToken: string | null): boolean {
  if (!storedToken) return false;

  const a = Buffer.from(hashedToken, 'utf8');
  const b = Buffer.from(storedToken, 'utf8');

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function throwInvalidOrExpiredToken(reason: 'INVALID' | 'EXPIRED' | 'REPLAY' | 'INVALID_FORMAT', ip?: string): never {
  logger.warn('Token validation failed', {
    reason,
    ip,
  });
  throw new UnauthorizedError('INVALID_OR_EXPIRED_TOKEN', 'INVALID_OR_EXPIRED_TOKEN');
}

function generateVerificationTokenPair(): { token: string; hashedToken: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  const hashedToken = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, hashedToken, expiresAt };
}

export const AuthService = {
  async register(email: string, password: string, role: UserRole, referralCode?: string) {
    const existing = await UserModel.findByEmail(email);
    if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

    const password_hash = await hashPassword(password);
    const verify_token = AUTO_VERIFY_EMAIL_ON_REGISTER ? null : randomBytes(32).toString('hex');
    const MAX_REFERRAL_CODE_ATTEMPTS = 10;
    let lastErr: unknown;
    let user:
      | Awaited<ReturnType<typeof UserModel.create>>
      | null = null;

    for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt++) {
      const myReferralCode = generateReferralCode();
      try {
        user = await UserModel.create({
          email,
          password_hash,
          role,
          verify_token,
          referral_code: myReferralCode,
        });
        break;
      } catch (err: unknown) {
        lastErr = err;
        const code = (err as { code?: string } | null)?.code;
        // 23505 = unique_violation (email or referral_code)
        if (code === '23505') {
          // If the email is now taken (race condition), stop retrying and return a clear error.
          const maybeEmailTaken = await UserModel.findByEmail(email);
          if (maybeEmailTaken) {
            throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
          }
          // Otherwise assume referral_code collision and retry.
          continue;
        }
        throw err;
      }
    }

    if (!user) {
      console.error('Failed to generate unique referral code after retries', lastErr);
      throw Object.assign(new Error('Could not create account. Please try again.'), {
        statusCode: 500,
      });
    }

    // Ensure role profile exists for new signups.
    await ProfileBootstrapService.ensureRoleProfileWithSql(user.id, role);

    // Handle referral
    if (referralCode) {
      const referrer = await UserModel.findByReferralCode(referralCode);
      if (referrer && referrer.id !== user.id) {
        await ReferralModel.create(referrer.id, user.id);
      }
    }

    if (AUTO_VERIFY_EMAIL_ON_REGISTER) {
      await UserModel.verify(user.id);

      // Keep registration credit/referral behavior aligned with verified users.
      await CreditService.grantRegistrationCredits(user.id);
      const referral = await ReferralModel.findByReferredId(user.id);
      if (referral && !referral.referrer_credited) {
        await CreditService.grantReferralRewards(referral.referrer_id, user.id);
        await ReferralModel.markReferrerCredited(referral.id);
        await ReferralModel.markReferredCredited(referral.id);
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerificationRequired: false,
        message: 'Email auto-verified for now. Re-enable verification by setting AUTO_VERIFY_EMAIL_ON_REGISTER=false.',
      };
    }

    // Send verification email without blocking registration response.
    // This prevents SMTP timeouts from making the signup request appear stuck.
    void sendEmail({
      to: email,
      subject: 'Verify your Hiring Platform account',
      html: verificationEmailHtml(email, verify_token as string),
    }).catch((err) => {
      logger.error('Failed to send registration verification email', {
        email,
        error: err,
      });
    });

    return { id: user.id, email: user.email, role: user.role, emailVerificationRequired: true };
  },

  async verifyEmail(token: string) {
    const user = await UserModel.findByVerifyToken(token);
    if (!user)
      throw Object.assign(new Error('Invalid or expired verification token'), { statusCode: 400 });

    await UserModel.verify(user.id);

    // Grant registration credits
    await CreditService.grantRegistrationCredits(user.id);

    // Grant referral rewards if applicable
    const referral = await ReferralModel.findByReferredId(user.id);
    if (referral && !referral.referrer_credited) {
      await CreditService.grantReferralRewards(referral.referrer_id, user.id);
      await ReferralModel.markReferrerCredited(referral.id);
      await ReferralModel.markReferredCredited(referral.id);
    }

    return { message: 'Email verified successfully' };
  },

  async login(email: string, password: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    if (!user.is_verified)
      throw Object.assign(new Error('Please verify your email first'), { statusCode: 403 });

    if (user.banned_at)
      throw Object.assign(new Error('Your account has been suspended. Please contact support.'), {
        statusCode: 403,
      });

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

    // Self-heal legacy users that were created without role profile rows.
    await ProfileBootstrapService.ensureRoleProfileWithSql(user.id, user.role);

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  },

  async refreshToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const blacklistKey = `${LOGOUT_REFRESH_PREFIX}${tokenHash}`;

    try {
      if (redis.status === 'wait' || redis.status === 'end') {
        await redis.connect();
      }

      const isBlacklisted = await redis.get(blacklistKey);
      if (isBlacklisted) {
        throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }

      logger.warn('Refresh token blacklist check skipped', {
        error: err,
      });
    }

    const payload = verifyToken(token);
    const user = await UserModel.findById(payload.userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 401 });

    const newPayload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    return { accessToken: signAccessToken(newPayload) };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
      return { loggedOut: true };
    }

    const token = refreshToken.trim();

    try {
      const payload = verifyToken(token);
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      const exp = typeof decoded?.exp === 'number' ? decoded.exp : null;
      const now = Math.floor(Date.now() / 1000);
      const ttlSeconds = exp ? Math.max(1, exp - now) : 7 * 24 * 60 * 60;

      if (redis.status === 'wait' || redis.status === 'end') {
        await redis.connect();
      }

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const blacklistKey = `${LOGOUT_REFRESH_PREFIX}${tokenHash}`;
      await redis.set(blacklistKey, '1', 'EX', ttlSeconds);

      logger.info('User logged out', {
        userId: payload.userId,
      });
    } catch {
      // Always return success to keep logout idempotent and avoid token probing.
    }

    return { loggedOut: true };
  },

  async forgotPassword(email: string) {
    const user = await UserModel.findByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await UserModel.setResetToken(user.id, token, expiresAt);

    void sendEmail({
      to: email,
      subject: 'Reset your Hiring Platform password',
      html: passwordResetEmailHtml(email, token),
    }).catch((err) => {
      logger.error('Failed to send forgot-password email', {
        email,
        error: err,
      });
    });
  },

  async resetPassword(token: string, newPassword: string) {
    const user = await UserModel.findByResetToken(token);
    if (!user)
      throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });

    const password_hash = await hashPassword(newPassword);
    await UserModel.updatePassword(user.id, password_hash);
  },

  async addEmail(userId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }

    const existing = await prisma.users.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.id !== userId) {
      throw Object.assign(new Error('Email already in use'), {
        statusCode: 409,
        code: 'EMAIL_ALREADY_IN_USE',
      });
    }

    const { token, hashedToken, expiresAt } = generateVerificationTokenPair();

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        is_email_dummy: false,
        email_verified: false,
        email_verification_token: hashedToken,
        email_verification_expires: expiresAt,
      },
      select: { id: true, email: true, role: true },
    });

    void sendEmail({
      to: normalizedEmail,
      subject: 'Verify your email address',
      html: oauthEmailVerificationHtml(normalizedEmail, token),
    }).catch((err) => {
      logger.error('Failed to send OAuth verification email', {
        email: normalizedEmail,
        userId,
        error: err,
      });
    });

    logger.info('Email verification initiated', { userId, email: normalizedEmail });

    return {
      user: updated,
      requiresVerification: true,
      message: 'Verification email sent. Please verify your email to continue.',
    };
  },

  async verifyOAuthEmail(token: string, ip?: string) {
    if (!token || typeof token !== 'string' || token.length < 32) {
      throwInvalidOrExpiredToken('INVALID_FORMAT', ip);
    }

    const hashedToken = hashVerificationToken(token);

    const verifiedUserId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.users.findFirst({
        where: { email_verification_token: hashedToken },
        select: {
          id: true,
          email_verification_token: true,
          email_verification_expires: true,
        },
      });

      if (!user) {
        throwInvalidOrExpiredToken('INVALID', ip);
      }

      if (!user.email_verification_token) {
        throwInvalidOrExpiredToken('REPLAY', ip);
      }

      if (!timingSafeTokenMatch(hashedToken, user.email_verification_token)) {
        throwInvalidOrExpiredToken('INVALID', ip);
      }

      if (!user.email_verification_expires || user.email_verification_expires < new Date()) {
        throwInvalidOrExpiredToken('EXPIRED', ip);
      }

      // Atomically invalidate token (single-use) and verify in one transaction.
      const invalidated = await tx.users.updateMany({
        where: {
          id: user.id,
          email_verification_token: user.email_verification_token,
        },
        data: {
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
        },
      });

      if (invalidated.count !== 1) {
        throwInvalidOrExpiredToken('REPLAY', ip);
      }

      return user.id;
    });

    logger.info('Email verified', { userId: verifiedUserId });

    // TODO: Periodically clean expired tokens from DB.

    return { message: 'Email verified successfully' };
  },

  async resendOAuthEmailVerification(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        email_verified: true,
      },
    });

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }

    if (!user.email) {
      throw Object.assign(new Error('Email is required'), {
        statusCode: 400,
        code: 'EMAIL_REQUIRED',
      });
    }

    if (user.email_verified) {
      return { message: 'Email is already verified' };
    }

    const { token, hashedToken, expiresAt } = generateVerificationTokenPair();

    await prisma.users.update({
      where: { id: user.id },
      data: {
        email_verification_token: hashedToken,
        email_verification_expires: expiresAt,
      },
    });

    void sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: oauthEmailVerificationHtml(user.email, token),
    }).catch((err) => {
      logger.error('Failed to resend OAuth verification email', {
        email: user.email,
        userId: user.id,
        error: err,
      });
    });

    logger.info('Email verification initiated', { userId: user.id, email: user.email });

    return { message: 'Verification email resent successfully' };
  },
};
