import { Request, Response, NextFunction } from 'express';
import * as svc from './config.service';

export async function getConfigs(req: Request, res: Response, next: NextFunction) {
  try {
    const stored = await svc.getAllConfigs();
    // Merge stored values with defaults so frontend always gets all keys
    const merged = Object.entries(svc.CONFIG_DEFAULTS).map(([key, defaultValue]) => {
      const found = stored.find(c => c.key === key);
      return { key, value: found ? found.value : defaultValue };
    });
    // Also include any stored keys not in defaults (legacy)
    stored.forEach(c => {
      if (!svc.CONFIG_DEFAULTS[c.key]) merged.push(c);
    });
    res.json({ success: true, data: merged });
  } catch (e) { next(e); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { key, value } = req.body;
    await svc.setConfig(key, value);
    res.json({ success: true, message: `Config ${key} updated` });
  } catch (e) { next(e); }
}

export async function updateConfigBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { configs } = req.body as { configs: { key: string; value: string }[] };
    if (!Array.isArray(configs) || configs.length === 0) {
      res.status(400).json({ success: false, message: 'configs array is required' });
      return;
    }
    await svc.setConfigBatch(configs);
    res.json({ success: true, message: `${configs.length} settings saved` });
  } catch (e) { next(e); }
}
