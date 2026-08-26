import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: Record<string, string[]>;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200, meta?: SuccessResponse<T>['meta']): void {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  res.status(statusCode).json(response);
}

export function sendError(res: Response, statusCode: number, code: string, message: string, errors?: Record<string, string[]>): void {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  if (errors) response.error.errors = errors;
  res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  perPage: number
): void {
  sendSuccess(res, data, 200, {
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
}
