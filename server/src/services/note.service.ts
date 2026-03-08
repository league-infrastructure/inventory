import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from './errors';
import { NoteRecord, CreateNoteInput, UpdateNoteInput } from '../contracts';

const VALID_OBJECT_TYPES = ['Kit', 'Pack', 'Computer'];

const NOTE_INCLUDE = { user: { select: { id: true, displayName: true } } } as const;

export class NoteService {
  constructor(private prisma: PrismaClient) {}

  async list(objectType: string, objectId: number): Promise<NoteRecord[]> {
    const notes = await this.prisma.note.findMany({
      where: { objectType, objectId },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return notes as unknown as NoteRecord[];
  }

  async create(input: CreateNoteInput, userId: number): Promise<NoteRecord> {
    if (!VALID_OBJECT_TYPES.includes(input.objectType)) {
      throw new ValidationError(`Invalid objectType: ${input.objectType}`);
    }
    if (!input.text || input.text.trim().length === 0) {
      throw new ValidationError('Note text is required');
    }

    const note = await this.prisma.note.create({
      data: {
        objectType: input.objectType,
        objectId: input.objectId,
        text: input.text.trim(),
        userId,
      },
      include: NOTE_INCLUDE,
    });
    return note as unknown as NoteRecord;
  }

  async update(id: number, input: UpdateNoteInput, userId: number): Promise<NoteRecord> {
    const existing = await this.prisma.note.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Note not found');

    if (!input.text || input.text.trim().length === 0) {
      throw new ValidationError('Note text is required');
    }

    const note = await this.prisma.note.update({
      where: { id },
      data: { text: input.text.trim() },
      include: NOTE_INCLUDE,
    });
    return note as unknown as NoteRecord;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.note.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Note not found');
    await this.prisma.note.delete({ where: { id } });
  }
}
