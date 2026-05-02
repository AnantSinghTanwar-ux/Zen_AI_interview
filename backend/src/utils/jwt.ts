import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const signAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  } as jwt.SignOptions);

export const signRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
