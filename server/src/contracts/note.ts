export interface NoteRecord {
  id: number;
  objectType: string;
  objectId: number;
  text: string;
  userId: number;
  user: { id: number; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  objectType: 'Kit' | 'Pack' | 'Computer';
  objectId: number;
  text: string;
}

export interface UpdateNoteInput {
  text: string;
}
