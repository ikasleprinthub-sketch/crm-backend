import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log request body
  if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
    logger.debug(`${req.method} ${req.url} - Request Body: ${JSON.stringify(req.body, null, 2)}`);
  }

  // Intercept the send method to log response body
  const originalSend = res.send;
  res.send = function (body: any): Response {
    const duration = Date.now() - start;
    
    // Only log if it's not too large (e.g., list of users)
    let bodyToLog = body;
    try {
      if (typeof body === 'string' && body.length < 2000) {
        bodyToLog = JSON.parse(body);
      }
    } catch (e) {
      // Not JSON
    }

    if (res.statusCode >= 400) {
      logger.error(`${req.method} ${req.url} [${res.statusCode}] - ${duration}ms - Response: ${typeof bodyToLog === 'object' ? JSON.stringify(bodyToLog, null, 2) : bodyToLog}`);
    } else {
      logger.debug(`${req.method} ${req.url} [${res.statusCode}] - ${duration}ms - Response: ${typeof bodyToLog === 'object' ? JSON.stringify(bodyToLog, null, 2) : '...' }`);
    }

    return originalSend.call(this, body);
  };

  next();
}
