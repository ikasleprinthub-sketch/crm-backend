import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 5000 : 3000,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true, // sends RateLimit-* headers so clients can read Retry-After
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 1000 : 50,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

export const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 2000 : 500,
  message: { success: false, message: 'Too many profile requests, please try again later.' },
});
