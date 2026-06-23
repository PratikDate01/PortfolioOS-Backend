import { Request, Response } from 'express';
import { AnalyticsEventModel } from '../models/analyticsEvent.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';
import { cacheService } from '../services/cacheService';

// Record visit for a specific portfolio (based on username)
export const recordVisit = async (req: Request, res: Response) => {
  try {
    const { username, sessionId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }

    const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ error: 'Portfolio owner not found' });
      return;
    }

    const portfolioOwnerId = user._id;
    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Log the page view event
    const event = new AnalyticsEventModel({
      portfolioOwnerId,
      sessionId: sid,
      type: 'page_view',
      path: `/p/${username}`,
      referrer: req.headers.referer || '',
      device: req.headers['user-agent'] ? (req.headers['user-agent'].includes('Mobile') ? 'Mobile' : 'Desktop') : 'Desktop'
    });
    await event.save();

    // Calculate unique visitor count for this portfolio owner
    const totalVisitorsResult = await AnalyticsEventModel.distinct('sessionId', { portfolioOwnerId });
    const totalVisitors = totalVisitorsResult.length;

    res.json({
      data: {
        totalVisitors,
        isNewVisitor: true,
        sessionId: sid
      },
    });
  } catch (error) {
    console.error('Visit recording error:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
};

export const getVisitorCount = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;

    if (!username) {
      res.status(400).json({ error: 'username parameter is required' });
      return;
    }

    const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const portfolioOwnerId = user._id;

    // Count unique sessions for this owner
    const uniqueSessions = await AnalyticsEventModel.distinct('sessionId', { portfolioOwnerId });
    // Active visitors in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeSessions = await AnalyticsEventModel.distinct('sessionId', {
      portfolioOwnerId,
      createdAt: { $gte: fiveMinutesAgo }
    });

    res.json({
      data: {
        totalVisitors: uniqueSessions.length,
        activeVisitors: activeSessions.length,
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
    const { sessionId, type, path, referrer, metadata, username } = req.body;
    let portfolioOwnerId = req.body.portfolioOwnerId;

    if (!sessionId || !type || !path) {
      res.status(400).json({ error: 'sessionId, type, and path are required' });
      return;
    }

    // Resolve portfolioOwnerId if username is provided
    if (!portfolioOwnerId && username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (user) {
        portfolioOwnerId = user._id;
      }
    }

    // If still not provided, fallback to logged-in user
    if (!portfolioOwnerId) {
      if (req.user?.id) {
        portfolioOwnerId = req.user.id;
      } else {
        res.status(400).json({ error: 'portfolioOwnerId or username is required' });
        return;
      }
    }

    const event = new AnalyticsEventModel({
      portfolioOwnerId,
      sessionId,
      userId: req.user?.id ? req.user.id as any : undefined,
      type,
      path,
      referrer,
      device: req.headers['user-agent'] ? (req.headers['user-agent'].includes('Mobile') ? 'Mobile' : 'Desktop') : 'Desktop',
      metadata
    });

    await event.save();

    res.status(201).json({ data: event });
  } catch (error) {
    console.error('Event logging error:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
};

// Admin/Dashboard analytics summary with DB aggregation isolated by owner
export const getAnalyticsSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const filter: Record<string, any> = {};
    if (req.user?.role !== 'superadmin') {
      filter.portfolioOwnerId = new mongoose.Types.ObjectId(ownerId);
    } else if (req.query.username) {
      // Admins can filter by specific user
      const user = await UserModel.findOne({ username: String(req.query.username).toLowerCase().trim() });
      if (user) {
        filter.portfolioOwnerId = user._id;
      }
    } else {
      filter.portfolioOwnerId = new mongoose.Types.ObjectId(ownerId);
    }

    const portfolioOwnerId = filter.portfolioOwnerId;

    if (!portfolioOwnerId) {
      res.status(400).json({ error: 'Context portfolioOwnerId could not be determined' });
      return;
    }

    const page = parseInt(req.query.page as string, 10);
    const limit = parseInt(req.query.limit as string, 10) || 30;

    const cacheKey = `analytics_summary:${portfolioOwnerId.toString()}:${page}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json({ data: cached });
      return;
    }

    const recentEventsQuery = AnalyticsEventModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');

    let recentEvents;
    let pagination;

    if (page) {
      const skip = (page - 1) * limit;
      const total = await AnalyticsEventModel.countDocuments(filter);
      recentEvents = await recentEventsQuery.skip(skip).limit(limit);
      pagination = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } else {
      recentEvents = await recentEventsQuery.limit(limit);
    }

    // Aggregate page views by path for this owner
    const pageViewsByPath = await AnalyticsEventModel.aggregate([
      { $match: { ...filter, type: 'page_view' } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Aggregate actions by type for this owner
    const eventsByType = await AnalyticsEventModel.aggregate([
      { $match: filter },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Count total unique visitors (sessions) for this owner
    const uniqueSessions = await AnalyticsEventModel.distinct('sessionId', filter);

    // Active visitors in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeSessions = await AnalyticsEventModel.distinct('sessionId', {
      ...filter,
      createdAt: { $gte: fiveMinutesAgo }
    });

    const result = {
      totalVisitors: uniqueSessions.length,
      activeVisitors: activeSessions.length,
      recentEvents,
      pageViewsByPath,
      eventsByType,
      ...(pagination && { pagination })
    };

    await cacheService.set(cacheKey, result, 30); // cache for 30s

    res.json({ data: result });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get analytics summary' });
  }
};
