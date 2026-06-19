import { Request, Response } from 'express';
import { ProjectModel } from '../models/project.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { awardXp } from '../services/gamification';

export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, tag, status, search } = req.query;
    const filter: Record<string, any> = {};

    // Restrict guest/member/public users to only see published projects
    const userRole = req.user?.role;
    if (userRole === 'owner' || userRole === 'admin') {
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

    const projects = await ProjectModel.find(filter).sort({ order: 1, createdAt: -1 });
    res.status(200).json({ data: projects });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing projects' });
  }
};

export const getProjectBySlug = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const project = await ProjectModel.findOne({ slug });

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

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectData = req.body;
    
    // Generate slug from title if not provided
    if (!projectData.slug && projectData.title) {
      projectData.slug = projectData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify uniqueness of slug
    const existing = await ProjectModel.findOne({ slug: projectData.slug });
    if (existing) {
      res.status(400).json({ error: 'A project with this slug or title already exists' });
      return;
    }

    const project = new ProjectModel(projectData);
    await project.save();

    res.status(201).json({ data: project });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating project' });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const project = await ProjectModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(200).json({ data: project });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating project' });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Soft delete as per spec: status -> archived
    const project = await ProjectModel.findByIdAndUpdate(
      id,
      { status: 'archived' },
      { new: true }
    );

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(200).json({ data: project, message: 'Project archived successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting project' });
  }
};
