import { Request, Response } from 'express';
import SiteConfig from '../models/siteConfig.model';
import { AnalyticsEventModel } from '../models/analyticsEvent.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// In-memory visitor tracking
let totalVisitors = 0;
let isInitialized = false;
const visitedIPs = new Set<string>();

async function initializeCounter() {
  if (isInitialized) return;

  try {
    const config = await SiteConfig.findOne();
    if (config) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalVisitors = (config as any).totalVisitors || 0;
    }
  } catch {
    // If DB is not available, start from 0
  }

  isInitialized = true;
}

// Persist counter to DB periodically (every 50 visits)
let pendingSaves = 0;

async function persistCounter() {
  try {
    await SiteConfig.findOneAndUpdate(
      {},
      { $set: { totalVisitors } },
      { upsert: true }
    );
    pendingSaves = 0;
  } catch (error) {
    console.error('Failed to persist visitor count:', error);
  }
}

export const recordVisit = async (req: Request, res: Response) => {
  try {
    await initializeCounter();

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Only count unique IPs in this session
    if (!visitedIPs.has(clientIp)) {
      visitedIPs.add(clientIp);
      totalVisitors++;
      pendingSaves++;

      // Persist every 50 visits
      if (pendingSaves >= 50) {
        await persistCounter();
      }
    }

    res.json({
      data: {
        totalVisitors,
        isNewVisitor: !visitedIPs.has(clientIp),
      },
    });
  } catch (error) {
    console.error('Visit recording error:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
};

export const getVisitorCount = async (req: Request, res: Response) => {
  try {
    await initializeCounter();

    res.json({
      data: {
        totalVisitors,
        activeVisitors: visitedIPs.size,
      },
    });
  } catch (error) {
    console.error('Visitor count error:', error);
    res.status(500).json({ error: 'Failed to get visitor count' });
  }
};

// Log discrete analytics event (page view, download, click)
export const logEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, type, path, referrer, metadata } = req.body;
    const userId = req.user?.id;

    if (!sessionId || !type || !path) {
      res.status(400).json({ error: 'sessionId, type, and path are required' });
      return;
    }

    const event = new AnalyticsEventModel({
      sessionId,
      userId,
      type,
      path,
      referrer,
      metadata
    });

    await event.save();

    res.status(201).json({ data: event });
  } catch (error) {
    console.error('Event logging error:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
};

// Admin analytics summary with DB aggregation
export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    await initializeCounter();

    const recentEvents = await AnalyticsEventModel.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name email');

    // Aggregate page views by path
    const pageViewsByPath = await AnalyticsEventModel.aggregate([
      { $match: { type: 'page_view' } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Aggregate actions by type
    const eventsByType = await AnalyticsEventModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      data: {
        totalVisitors,
        activeVisitors: visitedIPs.size,
        uniqueIPsThisSession: visitedIPs.size,
        recentEvents,
        pageViewsByPath,
        eventsByType
      },
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};
