import { AppError } from './errors';

export { AppError };

export const notFound = (resource = 'Resource') => new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const forbidden = (message = 'Access denied') => new AppError(message, 403, 'FORBIDDEN');

export const conflict = (message: string) => new AppError(message, 409, 'CONFLICT');

export const badRequest = (message: string, errors?: any[]) => {
  const err = new AppError(message, 400, 'BAD_REQUEST');
  if (errors) (err as any).errors = errors;
  return err;
};

export const unauthorized = (message = 'Invalid credentials') =>
  new AppError(message, 401, 'UNAUTHORIZED');
