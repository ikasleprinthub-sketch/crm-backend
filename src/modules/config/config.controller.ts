import { Request, Response, NextFunction } from 'express';
import * as svc from './config.service';

export async function getConfigs(req: Request, res: Response, next: NextFunction) {
  try {
    const configs = await svc.getAllConfigs();
    res.json({ success: true, data: configs });
  } catch (e) { next(e); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { key, value } = req.body;
    await svc.setConfig(key, value);
    res.json({ success: true, message: `Config ${key} updated` });
  } catch (e) { next(e); }
}
