import { Router } from 'express';
import { prisma } from '../../services/prisma';

export const adminQuartermastersRouter = Router();

// List all Quartermaster patterns
adminQuartermastersRouter.get('/quartermasters', async (_req, res) => {
  const patterns = await prisma.quartermasterPattern.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json(patterns);
});

// Add a Quartermaster pattern
adminQuartermastersRouter.post('/quartermasters', async (req, res) => {
  const { pattern, isRegex } = req.body;
  if (!pattern || typeof pattern !== 'string' || pattern.trim().length === 0) {
    return res.status(400).json({ error: 'Pattern is required' });
  }

  if (isRegex) {
    try {
      new RegExp(pattern.trim(), 'i');
    } catch {
      return res.status(400).json({ error: 'Invalid regular expression' });
    }
  }

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

// Delete a Quartermaster pattern
adminQuartermastersRouter.delete('/quartermasters/:id', async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.quartermasterPattern.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pattern not found' });
  }
  await prisma.quartermasterPattern.delete({ where: { id } });
  res.json({ success: true });
});
