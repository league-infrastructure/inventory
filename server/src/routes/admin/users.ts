import { Router } from 'express';
import { prisma } from '../../services/prisma';
import { USER_ROLES } from '../../contracts';

export const adminUsersRouter = Router();

// List all users
adminUsersRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        googleId: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get single user
adminUsersRouter.get('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        googleId: true,
        email: true,
        displayName: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            custodiedKits: true,
            custodiedComputers: true,
            transfers: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Create a user (for pre-provisioning before Google login)
adminUsersRouter.post('/users', async (req, res, next) => {
  try {
    const { email, displayName, role } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const validRoles: readonly string[] = USER_ROLES;
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName: displayName || email.split('@')[0],
        role: role || 'INSTRUCTOR',
      },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// Update a user
adminUsersRouter.put('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { displayName, email, role } = req.body;
    const validRoles: readonly string[] = USER_ROLES;
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Delete a user
adminUsersRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { custodiedKits: true, custodiedComputers: true },
        },
      },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (existing._count.custodiedKits > 0 || existing._count.custodiedComputers > 0) {
      return res.status(409).json({
        error: 'Cannot delete user who is custodian of kits or computers. Reassign custody first.',
      });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
