import { Request, Response } from 'express';
import { ProjectModel } from '../models/project.model';
import { UserModel } from '../models/user.model';
import { SubscriptionModel } from '../models/subscription.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';
import mongoose from 'mongoose';

export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, tag, status, search, username } = req.query;
    const filter: Record<string, any> = {};

    // Enforce tenant boundary
    if (username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (!user) {
        res.status(200).json({ data: [] });
        return;
      }
      filter.ownerId = user._id;
    } else if (req.user?.id) {
      // If logged in and no username query, view own content
      filter.ownerId = req.user.id;
    } else {
      res.status(400).json({ error: 'username query parameter is required for public requests' });
      return;
    }

    // Restrict guest/member/public users to only see published projects
    const userRole = req.user?.role;
    const isOwner = req.user?.id && filter.ownerId && req.user.id.toString() === filter.ownerId.toString();
    const isAdmin = userRole === 'superadmin' || userRole === 'admin';

    if (isAdmin || isOwner) {
      if (status) {
        filter.status = status;
      }
    } else {
      filter.status = 'published';
    }

    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    
    if (search) {
      filter.$text = { $search: search as string };
    }

    const page = parseInt(req.query.page as string, 10);
    const limit = parseInt(req.query.limit as string, 10);

    const projectsQuery = ProjectModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      const total = await ProjectModel.countDocuments(filter);
      const projects = await projectsQuery.skip(skip).limit(limit);
      res.status(200).json({
        data: projects,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      const projects = await projectsQuery;
      res.status(200).json({ data: projects });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error listing projects' });
  }
};

export const getProjectBySlug = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { username } = req.query;
    const filter: Record<string, any> = { slug };

    if (username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (!user) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      filter.ownerId = user._id;
    } else if (req.user?.id) {
      filter.ownerId = req.user.id;
    } else {
      res.status(400).json({ error: 'username query parameter is required for public requests' });
      return;
    }

    const project = await ProjectModel.findOne(filter);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Increment view counter asynchronously
    project.viewCount = (project.viewCount || 0) + 1;
    await project.save();

    // Award XP for viewing project case study (+10 XP)
    let gamificationResult = null;
    if (req.user?.id) {
      gamificationResult = await awardXp(req.user.id, 'project_view', 10, { projectSlug: slug, projectId: project._id.toString() });
    }

    res.status(200).json({ data: project, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving project' });
  }
};

export const createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check plan limits
    const sub = await SubscriptionModel.findOne({ userId: ownerId });
    if (sub) {
      const activeCount = await ProjectModel.countDocuments({ ownerId, status: { $ne: 'archived' } });
      if (activeCount >= sub.limits.maxProjects) {
        res.status(403).json({
          error: `Max projects limit reached for your plan (${sub.limits.maxProjects}). Please upgrade to add more projects.`,
        });
        return;
      }
    }

    projectData.ownerId = ownerId;
    
    // Generate slug from title if not provided
    if (!projectData.slug && projectData.title) {
      projectData.slug = projectData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify uniqueness of slug per owner
    const existing = await ProjectModel.findOne({ ownerId, slug: projectData.slug });
    if (existing) {
      res.status(400).json({ error: 'A project with this slug or title already exists in your portfolio' });
      return;
    }

    const project = new ProjectModel(projectData);
    await project.save();

    res.status(201).json({ data: project });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating project' });
  }
};

export const updateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const project = await ProjectModel.findById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.ownerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to edit this project' });
      return;
    }

    const updated = await ProjectModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    res.status(200).json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating project' });
  }
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const project = await ProjectModel.findById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.ownerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to delete this project' });
      return;
    }

    project.status = 'archived';
    await project.save();
    res.status(200).json({ data: project, message: 'Project archived successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting project' });
  }
};
