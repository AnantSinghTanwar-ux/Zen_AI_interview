import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200,
) => {
  res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (res: Response, message: string, statusCode = 400, errors?: unknown, errorCode?: string) => {
  const body: Record<string, unknown> = { success: false, message };
  if (errorCode) body.error = errorCode;
  if (errors) body.errors = errors;
  res.status(statusCode).json(body);
};

export const sendPaginated = (
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
  message = 'Success',
) => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};
