import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { OAuthAuthService, type OAuthProvider } from '../services/oauth.service';
import { OAuthStateService } from '../services/oauthState.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, role, referralCode } = req.body;
      const data = await AuthService.register(email, password, role, referralCode);
      sendSuccess(res, data, 'Registration successful.', 201);
    } catch (err) {
      next(err);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.verifyEmail(req.query.token as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const data = await AuthService.login(email, password);
      sendSuccess(res, data, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async oauthLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = req.body.provider as OAuthProvider;
      const tokenOrCode = (req.body.tokenOrCode || req.body.idToken || req.body.code) as string;
      const referralCode =
        typeof req.body.referralCode === 'string' && req.body.referralCode.trim()
          ? req.body.referralCode.trim()
          : undefined;

      console.info(`[AuthController] OAuth login attempt provider=${provider} ip=${req.ip}`);

      if (!tokenOrCode) {
        if (provider === 'github') {
          throw new UnauthorizedError('Invalid GitHub code', 'INVALID_GITHUB_CODE');
        }
        if (provider === 'linkedin') {
          throw new UnauthorizedError('Invalid LinkedIn code', 'INVALID_LINKEDIN_CODE');
        }
      }

      const data = await OAuthAuthService.login(provider, tokenOrCode, referralCode);
      sendSuccess(res, data, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      const referralCode =
        typeof req.body.referralCode === 'string' && req.body.referralCode.trim()
          ? req.body.referralCode.trim()
          : undefined;
      const role = (req.body.role === 'recruiter' || req.body.role === 'applicant') ? req.body.role : undefined;
      const hasToken = typeof idToken === 'string' && idToken.length > 0;

      logger.info(`[googleLogin] Received OAuth request`, { hasToken, role, ip: req.ip });

      if (!hasToken || idToken.length < 50) {
        throw new UnauthorizedError('Invalid Google token', 'INVALID_GOOGLE_TOKEN');
      }

      let data;
      try {
        data = await OAuthAuthService.login('google', idToken, referralCode, role);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          throw new UnauthorizedError('Invalid Google token', 'INVALID_GOOGLE_TOKEN');
        }
        throw error;
      }

      sendSuccess(res, data, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async githubLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;
      const referralCode =
        typeof req.body.referralCode === 'string' && req.body.referralCode.trim()
          ? req.body.referralCode.trim()
          : undefined;
      const role = (req.body.role === 'recruiter' || req.body.role === 'applicant') ? req.body.role : undefined;

      logger.info(`[githubLogin] Received OAuth request`, { role, ip: req.ip });

      if (typeof code !== 'string' || !code.trim()) {
        throw new UnauthorizedError('INVALID_GITHUB_CODE', 'INVALID_GITHUB_CODE');
      }

      if (!state || typeof state !== 'string') {
        throw new UnauthorizedError('INVALID_STATE');
      }

      const normalizedCode = code.trim();
      const normalizedState = state.trim();

      const stateValid = await OAuthStateService.consume('github', normalizedState);
      if (!stateValid) {
        throw new UnauthorizedError('INVALID_STATE');
      }

      const lock = await OAuthStateService.acquireCodeLock('github', normalizedCode, 300);
      if (!lock) {
        logger.warn('Replay attack prevented', {
          type: 'OAUTH_CODE',
          provider: 'github',
          ip: req.ip,
        });
        throw new UnauthorizedError('CODE_ALREADY_USED');
      }

      const data = await OAuthAuthService.login('github', normalizedCode, referralCode, role);

      // TODO: Move OAuth provider handlers to strategy pattern if more providers are added.
      sendSuccess(res, data, 'Login successful');
    } catch (err) {
      logger.error('GitHub OAuth failed', {
        error: err,
        ip: req.ip,
      });
      next(err);
    }
  },

  async linkedinLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;
      const referralCode =
        typeof req.body.referralCode === 'string' && req.body.referralCode.trim()
          ? req.body.referralCode.trim()
          : undefined;
      const role = (req.body.role === 'recruiter' || req.body.role === 'applicant') ? req.body.role : undefined;

      logger.info('LinkedIn OAuth login attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });

      if (typeof code !== 'string' || !code.trim()) {
        throw new UnauthorizedError('INVALID_LINKEDIN_CODE');
      }

      if (typeof state !== 'string' || !state.trim()) {
        throw new UnauthorizedError('INVALID_STATE');
      }

      // LinkedIn OAuth requires r_liteprofile and r_emailaddress scopes.
      // Email may not always be returned and should be handled in the service layer.
      // Token exchange happens via: https://www.linkedin.com/oauth/v2/accessToken

      const normalizedCode = code.trim();
      const normalizedState = state.trim();
      const codeKey = `oauth_code:linkedin:${normalizedCode}`;

      const stateValid = await OAuthStateService.consume('linkedin', normalizedState);
      if (!stateValid) {
        throw new UnauthorizedError('INVALID_STATE');
      }
      // TODO: Ensure frontend generates and stores state before redirecting to LinkedIn.
      // TODO: Move state generation/storage into a dedicated pre-auth endpoint.

      const lock = await OAuthStateService.acquireCodeLock('linkedin', normalizedCode, 300);
      if (!lock) {
        logger.warn('Replay attack prevented', {
          type: 'OAUTH_CODE',
          provider: 'linkedin',
          ip: req.ip,
        });
        throw new UnauthorizedError('CODE_ALREADY_USED');
      }

      const result = await OAuthAuthService.login('linkedin', normalizedCode, referralCode, role);

      // TODO: Move OAuth providers to a strategy-based handler when providers grow.
      return sendSuccess(res, result);
    } catch (err) {
      logger.error('LinkedIn OAuth failed', {
        error: err,
        ip: req.ip,
      });
      next(err);
    }
  },

  async registerOAuthState(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = req.body.provider as OAuthProvider;
      const state = req.body.state as string;

      if (!provider || (provider !== 'github' && provider !== 'linkedin')) {
        throw new BadRequestError('Invalid OAuth provider', 'INVALID_OAUTH_PROVIDER');
      }

      if (!state || typeof state !== 'string' || state.trim().length < 16) {
        throw new BadRequestError('Invalid OAuth state', 'INVALID_STATE');
      }

      const normalizedState = state.trim();
      const ok = await OAuthStateService.register(provider, normalizedState, 600);
      if (!ok) {
        throw new BadRequestError('Failed to register OAuth state', 'STATE_REGISTRATION_FAILED');
      }

      sendSuccess(res, { provider, stateRegistered: true }, 'OAuth state registered');
    } catch (err) {
      next(err);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const data = await AuthService.refreshToken(refreshToken);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body ?? {};
      const data = await AuthService.logout(refreshToken);
      sendSuccess(res, data, 'Logout successful');
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.forgotPassword(req.body.email);
      sendSuccess(res, null, 'If that email exists, a reset link has been sent.');
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, null, 'Password reset successful');
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, req.user);
    } catch (err) {
      next(err);
    }
  },

  async addEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated', 'NOT_AUTHENTICATED');
      }

      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        throw new UnauthorizedError('Email is required', 'EMAIL_REQUIRED');
      }
      const data = await AuthService.addEmail(userId, email);
      sendSuccess(res, data, 'Verification email sent');
    } catch (err) {
      next(err);
    }
  },

  async verifyEmailPost(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        throw new UnauthorizedError('Verification token is required', 'TOKEN_REQUIRED');
      }

      const data = await AuthService.verifyOAuthEmail(token, req.ip);
      sendSuccess(res, data);
    } catch (err) {
      const errorLike = err as { code?: string; statusCode?: number };

      if (errorLike?.code === 'TOKEN_EXPIRED') {
        res.status(400).json({
          code: 'TOKEN_EXPIRED',
          message: 'Verification link expired. Please request a new one.',
        });
        return;
      }

      if (errorLike?.code === 'TOKEN_ALREADY_USED') {
        res.status(400).json({
          code: 'TOKEN_ALREADY_USED',
          message: 'This verification link has already been used.',
        });
        return;
      }

      if (errorLike?.code === 'INVALID_TOKEN') {
        res.status(400).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid verification link. Please request a new one.',
        });
        return;
      }

      next(err);
    }
  },

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated', 'NOT_AUTHENTICATED');
      }

      const data = await AuthService.resendOAuthEmailVerification(userId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
};
