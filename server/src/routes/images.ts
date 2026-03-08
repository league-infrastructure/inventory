import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max upload
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export function imageRouter(services: ServiceRegistry): Router {
  const router = Router();

  // Upload an image and attach it to a computer, kit, or pack
  router.post(
    '/images/upload',
    requireAuth,
    requireQuartermaster,
    upload.single('image'),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No image file provided' });
        }

        const { objectType, objectId } = req.body;
        if (!objectType || !objectId) {
          return res.status(400).json({ error: 'objectType and objectId are required' });
        }

        const validTypes = ['Computer', 'Kit', 'Pack'];
        if (!validTypes.includes(objectType)) {
          return res.status(400).json({ error: `objectType must be one of: ${validTypes.join(', ')}` });
        }

        const id = parseInt(objectId, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'objectId must be a number' });
        }

        // Create the processed image
        const image = await services.images.create(req.file.buffer);

        // Delete old image if replacing
        let oldImageId: number | null = null;

        // Attach to the object
        if (objectType === 'Computer') {
          const existing = await services.prisma.computer.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Computer not found' });
          oldImageId = existing.imageId;
          await services.prisma.computer.update({ where: { id }, data: { imageId: image.id } });
        } else if (objectType === 'Kit') {
          const existing = await services.prisma.kit.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Kit not found' });
          oldImageId = existing.imageId;
          await services.prisma.kit.update({ where: { id }, data: { imageId: image.id } });
        } else if (objectType === 'Pack') {
          const existing = await services.prisma.pack.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Pack not found' });
          oldImageId = existing.imageId;
          await services.prisma.pack.update({ where: { id }, data: { imageId: image.id } });
        }

        // Clean up old image
        if (oldImageId) {
          await services.images.delete(oldImageId).catch(() => {});
        }

        res.status(201).json(image);
      } catch (err) {
        next(err);
      }
    },
  );

  // Link an external URL as an image and attach to an object
  router.post(
    '/images/url',
    requireAuth,
    requireQuartermaster,
    async (req, res, next) => {
      try {
        const { url, objectType, objectId } = req.body;
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ error: 'url is required' });
        }
        if (!objectType || !objectId) {
          return res.status(400).json({ error: 'objectType and objectId are required' });
        }

        const validTypes = ['Computer', 'Kit', 'Pack'];
        if (!validTypes.includes(objectType)) {
          return res.status(400).json({ error: `objectType must be one of: ${validTypes.join(', ')}` });
        }

        const id = parseInt(objectId, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'objectId must be a number' });
        }

        const image = await services.images.createFromUrl(url);

        let oldImageId: number | null = null;
        if (objectType === 'Computer') {
          const existing = await services.prisma.computer.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Computer not found' });
          oldImageId = existing.imageId;
          await services.prisma.computer.update({ where: { id }, data: { imageId: image.id } });
        } else if (objectType === 'Kit') {
          const existing = await services.prisma.kit.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Kit not found' });
          oldImageId = existing.imageId;
          await services.prisma.kit.update({ where: { id }, data: { imageId: image.id } });
        } else if (objectType === 'Pack') {
          const existing = await services.prisma.pack.findUnique({ where: { id }, select: { imageId: true } });
          if (!existing) return res.status(404).json({ error: 'Pack not found' });
          oldImageId = existing.imageId;
          await services.prisma.pack.update({ where: { id }, data: { imageId: image.id } });
        }

        if (oldImageId) {
          await services.images.delete(oldImageId).catch(() => {});
        }

        res.status(201).json(image);
      } catch (err) {
        next(err);
      }
    },
  );

  // Serve image by ID — redirects for URL images, serves binary for uploaded images
  router.get('/images/:id', async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid image ID' });

      const image = await services.images.getData(id);
      if (!image) return res.status(404).json({ error: 'Image not found' });

      // URL-based image: redirect
      if (image.url) {
        return res.redirect(image.url);
      }

      // Binary image: serve directly
      if (!image.data) return res.status(404).json({ error: 'Image has no data' });

      res.set('Content-Type', image.mimeType);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('ETag', `"${image.checksum}"`);

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === `"${image.checksum}"`) {
        return res.status(304).end();
      }

      res.send(image.data);
    } catch (err) {
      next(err);
    }
  });

  // Delete image (and unlink from object)
  router.delete(
    '/images/:id',
    requireAuth,
    requireQuartermaster,
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid image ID' });

        const meta = await services.images.getMeta(id);
        if (!meta) return res.status(404).json({ error: 'Image not found' });

        // Unlink from any objects
        await services.prisma.computer.updateMany({ where: { imageId: id }, data: { imageId: null } });
        await services.prisma.kit.updateMany({ where: { imageId: id }, data: { imageId: null } });
        await services.prisma.pack.updateMany({ where: { imageId: id }, data: { imageId: null } });

        await services.images.delete(id);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
