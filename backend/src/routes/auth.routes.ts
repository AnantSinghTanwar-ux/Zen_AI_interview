import { Router } from 'express';
import { body, query } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const weakPasswords = new Set([
  '123456',
  '12345678',
  '123456789',
  'password',
  'password123',
  'qwerty123',
]);

const passwordPolicy = body('password').custom((value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Password is required');
  }
  if (value.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(value)) {
    throw new Error('Password must include at least one uppercase letter');
  }
  if (!/[a-z]/.test(value)) {
    throw new Error('Password must include at least one lowercase letter');
  }
  if (!/[0-9]/.test(value)) {
    throw new Error('Password must include at least one number');
  }
  if (weakPasswords.has(value.toLowerCase())) {
    throw new Error('Password is too weak. Please choose a stronger password');
  }
  return true;
});

const oauthCredentialPresence = body().custom((value) => {
  const payload = (value ?? {}) as {
    tokenOrCode?: unknown;
    idToken?: unknown;
    code?: unknown;
  };

  const hasCredential = Boolean(payload.tokenOrCode || payload.idToken || payload.code);
  if (!hasCredential) {
    throw new Error('At least one of tokenOrCode, idToken, or code is required');
  }

  return true;
});

router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  passwordPolicy,
  body('role').isIn(['applicant', 'recruiter']),
  body('referralCode').optional().isString(),
  validate,
  AuthController.register,
);

router.get('/verify-email', query('token').notEmpty(), validate, AuthController.verifyEmail);

router.post(
  '/verify-email',
  body('token').notEmpty().isString(),
  validate,
  AuthController.verifyEmailPost,
);

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  AuthController.login,
);

router.post(
  '/oauth/state',
  body('provider').isIn(['github', 'linkedin']),
  body('state').notEmpty().isString().isLength({ min: 16, max: 128 }),
  validate,
  AuthController.registerOAuthState,
);

router.post(
  '/google',
  oauthCredentialPresence,
  body('idToken').notEmpty().isString(),
  validate,
  AuthController.googleLogin,
);

router.post(
  '/github',
  body('code').notEmpty().isString(),
  body('state').notEmpty().isString(),
  validate,
  AuthController.githubLogin,
);

router.post(
  '/linkedin',
  body('code').notEmpty().isString(),
  body('state').notEmpty().isString(),
  validate,
  AuthController.linkedinLogin,
);

router.post(
  '/refresh-token',
  body('refreshToken').notEmpty(),
  validate,
  AuthController.refreshToken,
);

router.post(
  '/logout',
  body('refreshToken').optional().isString(),
  validate,
  AuthController.logout,
);

router.post(
  '/forgot-password',
  body('email').isEmail().normalizeEmail(),
  validate,
  AuthController.forgotPassword,
);

router.post(
  '/reset-password',
  body('token').notEmpty(),
  passwordPolicy,
  validate,
  AuthController.resetPassword,
);

router.get('/me', authenticate, AuthController.me);

// Dev-only: instantly verify an account without needing the email token
router.post(
  '/add-email',
  authenticate,
  body('email').isEmail().normalizeEmail(),
  validate,
  AuthController.addEmail,
);

router.post(
  '/resend-verification',
  authenticate,
  validate,
  AuthController.resendVerification,
);

if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/verify', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'email required' });
      return;
    }
    const pool = (await import('../config/database')).default;
    const result = await pool.query(
      `UPDATE users SET is_verified = TRUE, verify_token = NULL WHERE email = $1 RETURNING id, email`,
      [email],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    // Grant registration credits if not already granted
    const { CreditService } = await import('../services/credit.service');
    try {
      await CreditService.grantRegistrationCredits(result.rows[0].id);
    } catch {}
    res.json({ success: true, message: `✅ ${email} verified`, data: result.rows[0] });
  });
}

export default router;
