import { Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export const setAuthCookies = (
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
) => {
  response.cookie('accessToken', tokens.accessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });

  response.cookie('refreshToken', tokens.refreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (response: Response) => {
  response.clearCookie('accessToken', COOKIE_BASE_OPTIONS);
  response.clearCookie('refreshToken', COOKIE_BASE_OPTIONS);
};
