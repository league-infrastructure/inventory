import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../services/prisma';
import { requireQuartermaster } from '../middleware/requireAuth';

export const quartermasterRouter = Router();

// List all Quartermaster patterns (Quartermaster only)
quartermasterRouter.get('/quartermasters/patterns', requireQuartermaster, async (_req: Request, res: Response) => {
  const patterns = await prisma.quartermasterPattern.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json(patterns);
});

// Add a Quartermaster pattern (Quartermaster only)
quartermasterRouter.post('/quartermasters/patterns', requireQuartermaster, async (req: Request, res: Response) => {
  const { pattern, isRegex } = req.body;
  if (!pattern || typeof pattern !== 'string' || pattern.trim().length === 0) {
    return res.status(400).json({ error: 'Pattern is required' });
  }

  // Validate regex if flagged as regex
  if (isRegex) {
    try {
      new RegExp(pattern.trim(), 'i');
    } catch {
      return res.status(400).json({ error: 'Invalid regular expression' });
    }
  }

  // Check for duplicate
  const existing = await prisma.quartermasterPattern.findFirst({
    where: { pattern: pattern.trim() },
  });
  if (existing) {
    return res.status(409).json({ error: 'Pattern already exists' });
  }

  const created = await prisma.quartermasterPattern.create({
    data: {
      pattern: pattern.trim(),
      isRegex: isRegex ?? false,
    },
  });
  res.status(201).json(created);
});

// Delete a Quartermaster pattern (Quartermaster only)
quartermasterRouter.delete('/quartermasters/patterns/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.quartermasterPattern.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pattern not found' });
  }
  await prisma.quartermasterPattern.delete({ where: { id } });
  res.json({ success: true });
});
