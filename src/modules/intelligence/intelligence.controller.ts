import { Request, Response } from 'express';
import * as intelligenceService from './intelligence.service';

export async function getAttendanceTrends(req: Request, res: Response) {
  try {
    console.log('📊 IntelligenceController: getAttendanceTrends hit');
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const data = await intelligenceService.getAttendanceTrends(days);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ IntelligenceController error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPerformanceStats(req: Request, res: Response) {
  try {
    console.log('📊 IntelligenceController: getPerformanceStats hit');
    const data = await intelligenceService.getGlobalPerformance();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ IntelligenceController error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
