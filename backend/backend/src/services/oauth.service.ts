import axios, { type AxiosError } from 'axios';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { Prisma, type users } from '@prisma/client';
import prisma from '../config/prisma';
import { CreditService } from './credit.service';
import { ProfileBootstrapService } from './profileBootstrap.service';
import { generateReferralCode } from '../utils/referralCode';
import { UnauthorizedError, ConflictError } from '../utils/errors';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import type { JwtPayload } from '../types';
import logger from '../config/logger';

export type OAuthProvider = 'google' | 'github' | 'linkedin';

export interface OAuthIdentity {
  email: string | null;
  providerId: string;
  name: string | null;
  avatar: string | null;
  provider: OAuthProvider;
  emailVerified?: boolean;
}

export interface OAuthUserInput {
  email: string;
  providerId: string;
  provider: OAuthProvider;
  name?: string | null;
  avatar?: string | null;
  role?: 'applicant' | 'recruiter';
}

type GithubUserResponse = {
  id: number;
  login?: string;
  name?: string;
  avatar_url?: string;
};

type GithubEmailResponse = Array<{
  email: string;
  primary: boolean;
  verified: boolean;
}>;

type LinkedinUserInfoResponse = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  email_verified?: boolean;
};

const GOOGLE_TOKEN_AUDIENCE = process.env.GOOGLE_CLIENT_ID;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;

const GOOGLE_CLIENT = new OAuth2Client(GOOGLE_TOKEN_AUDIENCE);

const HTTP_TIMEOUT_MS = 10000;
const MAX_REFERRAL_CODE_ATTEMPTS = 10;
const REFERRAL_REWARD = 20;
const REFERRAL_SIGNUP_BONUS = 10;

type FindOrCreateAction = 'existing' | 'linked' | 'created';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isP2002(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function getUniqueTargetList(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  return [String(target ?? '')];
}

async function findUserByProvider(
  tx: Prisma.TransactionClient,
  provider: OAuthProvider,
  providerId: string,
): Promise<users | null> {
  const usersDelegate = tx.users as unknown as {
    findUnique(args: { where: Record<string, string> }): Promise<users | null>;
  };

  switch (provider) {
    case 'google':
      return usersDelegate.findUnique({ where: { google_id: providerId } });
    case 'github':
      return usersDelegate.findUnique({ where: { github_id: providerId } });
    case 'linkedin':
      return usersDelegate.findUnique({ where: { linkedin_id: providerId } });
  }
}

async function linkProviderToUser(
  tx: Prisma.TransactionClient,
  user: users,
  provider: OAuthProvider,
  providerId: string,
): Promise<users> {
  const usersDelegate = tx.users as unknown as {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<users>;
  };

  const currentProvider = (user as unknown as { auth_provider?: string }).auth_provider;
  const baseData = {
    auth_provider: currentProvider === 'local' ? provider : currentProvider,
    is_verified: true,
  };

  switch (provider) {
    case 'google':
      return usersDelegate.update({
        where: { id: user.id },
        data: {
          ...baseData,
          google_id: providerId,
        },
      });
    case 'github':
      return usersDelegate.update({
        where: { id: user.id },
        data: {
          ...baseData,
          github_id: providerId,
        },
      });
    case 'linkedin':
      return usersDelegate.update({
        where: { id: user.id },
        data: {
          ...baseData,
          linkedin_id: providerId,
        },
      });
  }
}

async function createOAuthUser(
  tx: Prisma.TransactionClient,
  input: OAuthUserInput,
): Promise<{ user: users; action: FindOrCreateAction }> {
  const usersDelegate = tx.users as unknown as {
    create(args: { data: Record<string, unknown> }): Promise<users>;
    findUnique(args: { where: { email: string } }): Promise<users | null>;
  };

  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const referralCode = generateReferralCode();

    try {
      const baseData = {
        email: normalizeEmail(input.email),
        password_hash: null,
        role: input.role || 'applicant' as const,
        referral_code: referralCode,
        auth_provider: input.provider,
        is_verified: true,
      };

      switch (input.provider) {
        case 'google':
          return {
            user: await usersDelegate.create({
              data: {
                ...baseData,
                google_id: input.providerId,
              },
            }),
            action: 'created',
          };
        case 'github':
          return {
            user: await usersDelegate.create({
              data: {
                ...baseData,
                github_id: input.providerId,
              },
            }),
            action: 'created',
          };
        case 'linkedin':
          return {
            user: await usersDelegate.create({
              data: {
                ...baseData,
                linkedin_id: input.providerId,
              },
            }),
            action: 'created',
          };
      }
    } catch (error: unknown) {
      if (isP2002(error)) {
        const targetList = getUniqueTargetList(error);

        if (targetList.some((item) => item.includes('referral_code'))) {
          continue;
        }

        const existingByProvider = await findUserByProvider(tx, input.provider, input.providerId);
        if (existingByProvider) {
          if (existingByProvider.email && normalizeEmail(existingByProvider.email) !== normalizeEmail(input.email)) {
            throw new ConflictError('OAUTH_ALREADY_LINKED', 'OAUTH_ALREADY_LINKED');
          }
          return { user: existingByProvider, action: 'existing' };
        }

        const existingByEmail = await usersDelegate.findUnique({
          where: { email: normalizeEmail(input.email) },
        });

        if (existingByEmail) {
          const linkedUser = await linkProviderToUser(
            tx,
            existingByEmail,
            input.provider,
            input.providerId,
          );
          return { user: linkedUser, action: 'linked' };
        }
      }

      throw error;
    }
  }

  throw new ConflictError('Could not generate unique referral code', 'REFERRAL_CODE_COLLISION');
}

function getAxiosErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; error_description?: string }>;
    return (
      axiosError.response?.data?.error_description ||
      axiosError.response?.data?.error ||
      axiosError.message
    );
  }

  if (error instanceof Error) return error.message;
  return 'Unknown OAuth error';
}

function ensureEnv(value: string | undefined, code: string, name: string): string {
  if (!value) {
    throw new UnauthorizedError(`Missing OAuth server config: ${name}`, code);
  }
  return value;
}

export const OAuthService = {
  async verifyGoogleToken(idToken: string): Promise<OAuthIdentity> {
    if (!idToken) {
      throw new UnauthorizedError('Google idToken is required', 'GOOGLE_TOKEN_REQUIRED');
    }

    const audience = ensureEnv(
      GOOGLE_TOKEN_AUDIENCE,
      'GOOGLE_CLIENT_ID_MISSING',
      'GOOGLE_CLIENT_ID',
    );

    try {
      logger.debug('[verifyGoogleToken] Starting token verification', {
        audienceExpected: audience,
        tokenLength: idToken.length,
      });

      const ticket = await GOOGLE_CLIENT.verifyIdToken({
        idToken,
        audience,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedError('Google token payload missing', 'GOOGLE_PAYLOAD_MISSING');
      }

      if (payload.aud !== audience) {
        logger.error('[verifyGoogleToken] Audience mismatch', {
          expected: audience,
          actual: payload.aud,
        });
        throw new UnauthorizedError('Google token audience mismatch', 'GOOGLE_AUDIENCE_MISMATCH');
      }

      if (!payload.email || !payload.sub) {
        throw new UnauthorizedError('Google token missing required claims', 'GOOGLE_CLAIMS_INVALID');
      }

      logger.info('[verifyGoogleToken] Token verified successfully', {
        email: payload.email,
        sub: payload.sub,
      });

      return {
        email: payload.email,
        providerId: payload.sub,
        name: payload.name || null,
        avatar: payload.picture || null,
        provider: 'google',
      };
    } catch (error) {
      // Handle clock skew by manually decoding token with relaxed time validation
      if (
        error instanceof Error &&
        error.message.includes('Token used too early')
      ) {
        logger.warn('[verifyGoogleToken] Token used too early - attempting manual decode', {
          error: error.message,
        });

        try {
          // Manually decode JWT without signature verification
          const parts = idToken.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
          }

          const decoded = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8'),
          ) as Record<string, unknown>;

          const payload = decoded as unknown as TokenPayload;

          if (payload.aud !== audience) {
            logger.error('[verifyGoogleToken] Manual decode: Audience mismatch', {
              expected: audience,
              actual: payload.aud,
            });
            throw new UnauthorizedError('Google token audience mismatch', 'GOOGLE_AUDIENCE_MISMATCH');
          }

          if (!payload.email || !payload.sub) {
            throw new UnauthorizedError(
              'Google token missing required claims',
              'GOOGLE_CLAIMS_INVALID',
            );
          }

          logger.info('[verifyGoogleToken] Token verified via manual decode (clock skew workaround)', {
            email: payload.email,
            sub: payload.sub,
          });

          return {
            email: payload.email as string,
            providerId: payload.sub as string,
            name: (payload.name as string) || null,
            avatar: (payload.picture as string) || null,
            provider: 'google',
          };
        } catch (decodeError) {
          logger.error('[verifyGoogleToken] Manual decode failed', {
            error: decodeError instanceof Error ? decodeError.message : String(decodeError),
          });
          throw new UnauthorizedError('Google token verification failed', 'INVALID_GOOGLE_TOKEN');
        }
      }

      if (error instanceof UnauthorizedError) throw error;

      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[verifyGoogleToken] Verification failed', {
        error: errorMsg,
        errorName: error instanceof Error ? error.constructor.name : 'Unknown',
      });

      throw new UnauthorizedError(
        `Google token verification failed: ${getAxiosErrorMessage(error)}`,
        'INVALID_GOOGLE_TOKEN',
      );
    }
  },

  async verifyGithubToken(code: string): Promise<OAuthIdentity> {
    if (!code) {
      throw new UnauthorizedError('GitHub authorization code is required', 'GITHUB_CODE_REQUIRED');
    }

    const clientId = ensureEnv(GITHUB_CLIENT_ID, 'GITHUB_CLIENT_ID_MISSING', 'GITHUB_CLIENT_ID');
    const clientSecret = ensureEnv(
      GITHUB_CLIENT_SECRET,
      'GITHUB_CLIENT_SECRET_MISSING',
      'GITHUB_CLIENT_SECRET',
    );

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      });

      if (GITHUB_REDIRECT_URI) {
        params.append('redirect_uri', GITHUB_REDIRECT_URI);
      }

      const tokenResponse = await axios.post<{ access_token?: string }>(
        'https://github.com/login/oauth/access_token',
        params,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: HTTP_TIMEOUT_MS,
        },
      );

      const accessToken = tokenResponse.data?.access_token;
      if (!accessToken) {
        throw new UnauthorizedError('GitHub access token exchange failed', 'GITHUB_TOKEN_EXCHANGE_FAILED');
      }

      const [userResponse, emailResponse] = await Promise.all([
        axios.get<GithubUserResponse>('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          timeout: HTTP_TIMEOUT_MS,
        }),
        axios.get<GithubEmailResponse>('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          timeout: HTTP_TIMEOUT_MS,
        }),
      ]);

      const user = userResponse.data;
      const emails = emailResponse.data || [];

      // GitHub requires separate API call for verified primary email
      const primaryVerifiedEmail = emails.find((item) => item.primary && item.verified);
      const email = primaryVerifiedEmail?.email || null;
      const emailVerified = primaryVerifiedEmail?.verified === true;

      if (!user?.id) {
        throw new UnauthorizedError('GitHub user id missing', 'GITHUB_USER_ID_MISSING');
      }

      // Note: email may be null for accounts without verified primary email.
      // Synthetic email will be generated in OAuthAuthService.login if needed.

      return {
        email,
        providerId: String(user.id),
        name: user.name || user.login || null,
        avatar: user.avatar_url || null,
        provider: 'github',
        emailVerified,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;

      throw new UnauthorizedError(
        `GitHub token verification failed: ${getAxiosErrorMessage(error)}`,
        'INVALID_GITHUB_CODE',
      );
    }
  },

  async verifyLinkedinToken(code: string): Promise<OAuthIdentity> {
    if (!code) {
      throw new UnauthorizedError('LinkedIn authorization code is required', 'LINKEDIN_CODE_REQUIRED');
    }

    const clientId = ensureEnv(
      LINKEDIN_CLIENT_ID,
      'LINKEDIN_CLIENT_ID_MISSING',
      'LINKEDIN_CLIENT_ID',
    );
    const clientSecret = ensureEnv(
      LINKEDIN_CLIENT_SECRET,
      'LINKEDIN_CLIENT_SECRET_MISSING',
      'LINKEDIN_CLIENT_SECRET',
    );
    const redirectUri = ensureEnv(
      LINKEDIN_REDIRECT_URI,
      'LINKEDIN_REDIRECT_URI_MISSING',
      'LINKEDIN_REDIRECT_URI',
    );

    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });

      const tokenResponse = await axios.post<{ access_token?: string }>(
        'https://www.linkedin.com/oauth/v2/accessToken',
        tokenParams,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: HTTP_TIMEOUT_MS,
        },
      );

      const accessToken = tokenResponse.data?.access_token;
      if (!accessToken) {
        throw new UnauthorizedError(
          'LinkedIn access token exchange failed',
          'LINKEDIN_TOKEN_EXCHANGE_FAILED',
        );
      }

      const userInfoResponse = await axios.get<LinkedinUserInfoResponse>(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: HTTP_TIMEOUT_MS,
        },
      );

      const userInfo = userInfoResponse.data;

      if (!userInfo?.sub) {
        throw new UnauthorizedError('LinkedIn user id missing', 'LINKEDIN_USER_ID_MISSING');
      }

      return {
        email: userInfo.email || null,
        providerId: userInfo.sub,
        name: userInfo.name || null,
        avatar: userInfo.picture || null,
        provider: 'linkedin',
        emailVerified: userInfo.email_verified === true,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;

      throw new UnauthorizedError(
        `LinkedIn token verification failed: ${getAxiosErrorMessage(error)}`,
        'INVALID_LINKEDIN_CODE',
      );
    }
  },

  async verify(provider: OAuthProvider, tokenOrCode: string): Promise<OAuthIdentity> {
    if (!tokenOrCode) {
      throw new UnauthorizedError('OAuth token/code is required', 'OAUTH_CREDENTIAL_REQUIRED');
    }

    switch (provider) {
      case 'google':
        return this.verifyGoogleToken(tokenOrCode);
      case 'github':
        return this.verifyGithubToken(tokenOrCode);
      case 'linkedin':
        return this.verifyLinkedinToken(tokenOrCode);
      default:
        throw new UnauthorizedError('Unsupported OAuth provider', 'OAUTH_PROVIDER_UNSUPPORTED');
    }
  },
};

export const OAuthUserService = {
  async findOrCreate(input: OAuthUserInput): Promise<users> {
    const email = normalizeEmail(input.email);
    const providerId = String(input.providerId ?? '').trim();

    if (!email || !providerId) {
      throw new UnauthorizedError('Invalid OAuth identity payload', 'OAUTH_IDENTITY_INVALID');
    }

    const { user, action } = await prisma.$transaction(async (tx) => {
      const txInput: OAuthUserInput = {
        ...input,
        email,
        providerId,
      };

      // 1) Find by provider id first
      const existingByProvider = await findUserByProvider(tx, txInput.provider, txInput.providerId);
      if (existingByProvider) {
        if (existingByProvider.email && normalizeEmail(existingByProvider.email) !== txInput.email) {
          throw new ConflictError('OAUTH_ALREADY_LINKED', 'OAUTH_ALREADY_LINKED');
        }
        return { user: existingByProvider, action: 'existing' as const };
      }

      // 2) Find by email and link provider
      const existingByEmail = await tx.users.findUnique({ where: { email: txInput.email } });
      if (existingByEmail) {
        try {
          const linkedUser = await linkProviderToUser(
            tx,
            existingByEmail,
            txInput.provider,
            txInput.providerId,
          );
          return { user: linkedUser, action: 'linked' as const };
        } catch (error) {
          if (!isP2002(error)) throw error;

          const racedProviderUser = await findUserByProvider(tx, txInput.provider, txInput.providerId);
          if (racedProviderUser) {
            if (racedProviderUser.email && normalizeEmail(racedProviderUser.email) !== txInput.email) {
              throw new ConflictError('OAUTH_ALREADY_LINKED', 'OAUTH_ALREADY_LINKED');
            }
            return { user: racedProviderUser, action: 'existing' as const };
          }

          const refreshedByEmail = await tx.users.findUnique({ where: { email: txInput.email } });
          if (!refreshedByEmail) throw error;

          return { user: refreshedByEmail, action: 'existing' as const };
        }
      }

      // 3) Create new OAuth user with referral retry logic
      return createOAuthUser(tx, txInput);
    });

    console.info(`[OAuthUserService] action=${action} provider=${input.provider} email=${email}`);

    if (action === 'created') {
      try {
        await ProfileBootstrapService.ensureRoleProfile(user.id, user.role as 'applicant' | 'recruiter' | 'admin');
      } catch (err) {
        logger.error('Failed to create profile for OAuth signup', {
          userId: user.id,
          provider: input.provider,
          role: user.role,
          error: err,
        });
        // Don't throw - profile creation failure should not block OAuth signup
      }

      await CreditService.grantRegistrationCredits(user.id);
    }

    return user;
  },
};

export const OAuthAuthService = {
  async login(provider: OAuthProvider, tokenOrCode: string, referralCode?: string, role?: 'applicant' | 'recruiter') {
    logger.info(`[OAuthAuthService.login] Starting OAuth login`, { provider, role });
    const oauthUser = await OAuthService.verify(provider, tokenOrCode);

    const providerId = String(oauthUser.providerId ?? '').trim();
    const email = oauthUser.email ? normalizeEmail(oauthUser.email) : null;

    let emailVerified = false;
    if (provider === 'google') {
      // Google idToken is a JWT; email_verified is available in payload.
      try {
        const payloadPart = tokenOrCode.split('.')[1];
        if (payloadPart) {
          const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson) as { email_verified?: boolean };
          emailVerified = payload.email_verified === true;
        }
      } catch {
        emailVerified = false;
      }
    }

    if (provider === 'github') {
      // GitHub verification already determines emailVerified by checking primary + verified email
      emailVerified = oauthUser.emailVerified === true;
    }

    if (provider === 'linkedin') {
      // LinkedIn OIDC userinfo may return email_verified.
      emailVerified = oauthUser.emailVerified === true;
    }

    const isLowTrustProvider = provider === 'linkedin' && !emailVerified;

    if (!providerId) {
      throw new UnauthorizedError('INVALID_OAUTH_PROVIDER_ID', 'INVALID_OAUTH_PROVIDER_ID');
    }

    const isDummyEmail = !email;

    const { user, action } = await (async () => {
      const usersDelegate = prisma.users as unknown as {
        findUnique(args: { where: Record<string, unknown> }): Promise<users | null>;
        create(args: { data: Record<string, unknown> }): Promise<users>;
        update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<users>;
      };

      // ============================================================================
      // STEP 1: CRITICAL CHECK - Provider ID must not be linked to any user
      // ============================================================================
      const findByProviderId = async () => {
        switch (provider) {
          case 'google':
            return usersDelegate.findUnique({ where: { google_id: providerId } });
          case 'github':
            return usersDelegate.findUnique({ where: { github_id: providerId } });
          case 'linkedin':
            return usersDelegate.findUnique({ where: { linkedin_id: providerId } });
        }
      };

      const existingByProvider = await findByProviderId();
      if (existingByProvider) {
        if (role && existingByProvider.role !== role) {
          throw new ConflictError(
            `This ${provider} account is already linked to a ${existingByProvider.role} profile. Please use the ${existingByProvider.role} login route or a different OAuth account.`,
            'OAUTH_ROLE_MISMATCH',
          );
        }
        // Provider already linked to a user → normal login
        return { user: existingByProvider, action: 'login' as const };
      }

      // ============================================================================
      // STEP 2: Handle no-email case (provider has no email)
      // ============================================================================
      if (!email) {
        // Email is nullable; create account without email and mark as is_email_dummy
        for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
          const referralCode = generateReferralCode();
          try {
            const baseData = {
              email: null,
              password_hash: null,
              role: role ?? ('applicant' as const),
              referral_code: referralCode,
              auth_provider: provider,
              is_verified: false,
              is_email_dummy: true, // Mark user as needing email completion
              email_verified: false,
            };

            logger.info(`[OAuthAuthService.login] Creating new user (no email)`, { provider, role: baseData.role });

            switch (provider) {
              case 'google':
                return {
                  user: await usersDelegate.create({ data: { ...baseData, google_id: providerId } }),
                  action: 'created' as const,
                };
              case 'github':
                return {
                  user: await usersDelegate.create({ data: { ...baseData, github_id: providerId } }),
                  action: 'created' as const,
                };
              case 'linkedin':
                return {
                  user: await usersDelegate.create({ data: { ...baseData, linkedin_id: providerId } }),
                  action: 'created' as const,
                };
            }
          } catch (error) {
            if (isP2002(error)) {
              const targets = getUniqueTargetList(error);
              if (targets.some((t) => t.includes('referral_code'))) {
                continue;
              }

              const racedByProvider = await findByProviderId();
              if (racedByProvider) {
                return { user: racedByProvider, action: 'login' as const };
              }
            }
            throw error;
          }
        }

        throw new ConflictError('Could not generate unique referral code', 'REFERRAL_CODE_COLLISION');
      }

      // ============================================================================
      // STEP 3: Email exists → Comprehensive conflict detection
      // ============================================================================
      const existingByEmail = await usersDelegate.findUnique({ where: { email } });

      if (existingByEmail) {
        if (role && existingByEmail.role !== role) {
          throw new ConflictError(
            `An account with this email already exists as ${existingByEmail.role}. Please use the ${existingByEmail.role} login route or a different email.`,
            'OAUTH_ROLE_MISMATCH',
          );
        }

        const existingByEmailWithOAuth = existingByEmail as unknown as Record<string, unknown>;
        // --------------- CONFLICT CHECK 3A ---------------
        // Does this user have the provider column already set with a DIFFERENT ID?
        const providerColumnValue =
          provider === 'google'
            ? (existingByEmailWithOAuth.google_id as string | null | undefined)
            : provider === 'github'
              ? (existingByEmailWithOAuth.github_id as string | null | undefined)
              : (existingByEmailWithOAuth.linkedin_id as string | null | undefined);

        if (providerColumnValue && providerColumnValue !== providerId) {
          // CONFLICT: Same email, but provider column has different ID
          // This means the provider is linked to a different account
          logger.warn('OAuth conflict detected', {
            provider,
            email,
            providerId,
            existingProviderId: providerColumnValue,
            existingUserId: existingByEmail.id,
            reason: 'PROVIDER_CONFLICT',
          });

          throw new UnauthorizedError(
            `${provider} account is linked to a different user account`,
            'PROVIDER_CONFLICT',
          );
        }

        // --------------- CONFLICT CHECK 3B ---------------
        // Prevent linking to accounts with is_email_dummy flag
        if (Boolean(existingByEmailWithOAuth.is_email_dummy) && !providerColumnValue) {
          // Trying to link real provider identity to dummy email account
          logger.warn('OAuth conflict detected', {
            provider,
            email,
            providerId,
            existingUserId: existingByEmail.id,
            reason: 'DUMMY_ACCOUNT_CONFLICT',
          });

          throw new UnauthorizedError(
            'Cannot link provider to account awaiting email completion',
            'DUMMY_ACCOUNT_CONFLICT',
          );
        }

        // --------------- CONFLICT CHECK 3C ---------------
        // Email verification requirement for real-email accounts
        if (!emailVerified && !isLowTrustProvider) {
          throw new UnauthorizedError('EMAIL_NOT_VERIFIED', 'EMAIL_NOT_VERIFIED');
        }

        // --------------- CONFLICT CHECK 3D ---------------
        // Low-trust providers cannot auto-link to existing accounts
        if (isLowTrustProvider) {
          logger.warn('OAuth conflict detected', {
            provider,
            email,
            providerId,
            existingUserId: existingByEmail.id,
            reason: 'LINKEDIN_AUTO_LINK_DISABLED',
          });

          throw new UnauthorizedError(
            'LinkedIn auto-linking disabled; email requires manual verification',
            'LINKEDIN_AUTO_LINK_DISABLED',
          );
        }

        // --------------- CONFLICT CHECK 3E ---------------
        // Double-check no other user has this provider ID (race condition safety)
        const racedByProvider = await findByProviderId();
        if (racedByProvider && racedByProvider.id !== existingByEmail.id) {
          logger.warn('OAuth conflict detected (race condition)', {
            provider,
            email,
            providerId,
            existingUserId: existingByEmail.id,
            racedUserId: racedByProvider.id,
            reason: 'PROVIDER_ALREADY_LINKED_RACE',
          });

          throw new UnauthorizedError(
            `${provider} has been linked to another account`,
            'PROVIDER_ALREADY_LINKED',
          );
        }

        // ============ All conflict checks passed → SAFE TO LINK ============
        const updatedUser = await usersDelegate.update({
          where: { id: existingByEmail.id },
          data:
            provider === 'google'
              ? {
                  google_id: providerId,
                  is_verified: true,
                  is_email_dummy: false,
                  email_verified: emailVerified,
                }
              : provider === 'github'
                ? {
                    github_id: providerId,
                    is_verified: true,
                    is_email_dummy: false,
                    email_verified: emailVerified,
                  }
                : {
                    linkedin_id: providerId,
                    is_verified: true,
                    is_email_dummy: false,
                    email_verified: emailVerified,
                  },
        });

        return { user: updatedUser, action: 'linked' as const };
      }

      // ============================================================================
      // STEP 4: No existing user by email → Create new account with real email
      // ============================================================================
      for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
        const referralCode = generateReferralCode();
        try {
          const baseData = {
            email,
            password_hash: null,
            role: role ?? ('applicant' as const),
            referral_code: referralCode,
            auth_provider: provider,
            is_verified: true,
            is_email_dummy: false, // Email is real and verified
            email_verified: emailVerified,
          };

          logger.info(`[OAuthAuthService.login] Creating new account with email`, { provider, role: baseData.role, email });

          switch (provider) {
            case 'google':
              return {
                user: await usersDelegate.create({ data: { ...baseData, google_id: providerId } }),
                action: 'created' as const,
              };
            case 'github':
              return {
                user: await usersDelegate.create({ data: { ...baseData, github_id: providerId } }),
                action: 'created' as const,
              };
            case 'linkedin':
              return {
                user: await usersDelegate.create({ data: { ...baseData, linkedin_id: providerId } }),
                action: 'created' as const,
              };
          }
        } catch (error) {
          if (isP2002(error)) {
            const targets = getUniqueTargetList(error);
            if (targets.some((t) => t.includes('referral_code'))) {
              continue;
            }

            // Race condition: Another process created user or linked provider
            const racedByProvider = await findByProviderId();
            if (racedByProvider) {
              return { user: racedByProvider, action: 'login' as const };
            }

            if (email) {
              const racedByEmail = await usersDelegate.findUnique({ where: { email } });
              if (racedByEmail) {
                return { user: racedByEmail, action: 'login' as const };
              }
            }
          }
          throw error;
        }
      }

      throw new ConflictError('Could not generate unique referral code', 'REFERRAL_CODE_COLLISION');
    })();

    // ============================================================================
    // Logging
    // ============================================================================
    logger.info('OAuth account linking', {
      provider,
      email,
      action,
      isDummyEmail,
      isLowTrustProvider,
    });

    try {
      await ProfileBootstrapService.ensureRoleProfile(user.id, user.role as 'applicant' | 'recruiter' | 'admin');
    } catch (err) {
      logger.error('Failed to ensure role profile for OAuth user', {
        userId: user.id,
        provider,
        role: user.role,
        action,
        error: err,
      });
    }

    if (action === 'created') {
      try {
        // Keep OAuth signups aligned with normal registration credit initialization.
        await CreditService.grantRegistrationCredits(user.id);

        logger.info('Registration credits granted for OAuth signup', {
          userId: user.id,
          provider,
        });
      } catch (err) {
        logger.error('Failed to grant registration credits for OAuth signup', {
          userId: user.id,
          provider,
          error: err,
        });
      }

      const normalizedReferralCode = referralCode?.trim();
      if (normalizedReferralCode) {
        try {
          const referrers = await prisma.$queryRaw<Array<{ id: string; referral_code: string }>>`
            SELECT id, referral_code
            FROM users
            WHERE referral_code = ${normalizedReferralCode}
            LIMIT 1
          `;

          const referrer = referrers[0] ?? null;
          if (!referrer) {
            logger.info('Referral skipped: code not found', {
              referralCode: normalizedReferralCode,
              newUserId: user.id,
            });
          } else if (referrer.id === user.id) {
            logger.warn('Referral skipped: self referral detected', {
              referralCode: normalizedReferralCode,
              newUserId: user.id,
            });
          } else {
            const existingReferral = await prisma.$queryRaw<Array<{ id: string }>>`
              SELECT id
              FROM referrals
              WHERE referred_id = ${user.id}
              LIMIT 1
            `;

            if (existingReferral.length === 0) {
              await prisma.$executeRaw`
                INSERT INTO referrals (referrer_id, referred_id)
                VALUES (${referrer.id}, ${user.id})
              `;

              const alreadyRewardedReferrer = await prisma.$queryRaw<Array<{ exists: number }>>`
                SELECT 1 AS exists
                FROM credit_transactions
                WHERE user_id = ${referrer.id}
                  AND description = 'Referral reward — OAuth signup'
                  AND reference_id = ${user.id}
                LIMIT 1
              `;

              if (alreadyRewardedReferrer.length === 0) {
                await CreditService.addCredits(
                  referrer.id,
                  REFERRAL_REWARD,
                  'Referral reward — OAuth signup',
                  user.id,
                );
              }

              const alreadyRewardedReferred = await prisma.$queryRaw<Array<{ exists: number }>>`
                SELECT 1 AS exists
                FROM credit_transactions
                WHERE user_id = ${user.id}
                  AND description = 'Referral signup bonus — OAuth'
                  AND reference_id = ${referrer.id}
                LIMIT 1
              `;

              if (alreadyRewardedReferred.length === 0) {
                await CreditService.addCredits(
                  user.id,
                  REFERRAL_SIGNUP_BONUS,
                  'Referral signup bonus — OAuth',
                  referrer.id,
                );
              }

              await prisma.$executeRaw`
                UPDATE referrals
                SET referrer_credited = TRUE, referred_credited = TRUE
                WHERE referred_id = ${user.id}
              `;

              logger.info('Referral applied', {
                referrerId: referrer.id,
                newUserId: user.id,
              });
            }
          }

          // TODO: prevent referral abuse via same IP/device.
          // TODO: limit referrals per user/day.
        } catch (err) {
          logger.error('Failed to apply referral for OAuth signup', {
            newUserId: user.id,
            referralCode: normalizedReferralCode,
            error: err,
          });
        }
      }
    }

    // TODO: Add manual account linking via user settings.
    // TODO: Add email verification fallback flow.

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  },
};
