import { ItemRecord } from './item';

export interface PackRecord {
  id: number;
  name: string;
  description: string | null;
  qrCode: string | null;
  kitId: number;
  createdAt: string;
  updatedAt: string;
  items: ItemRecord[];
}

export interface PackDetailRecord extends PackRecord {
  kit: { id: number; name: string };
}

export interface CreatePackInput {
  name: string;
  description?: string | null;
}

export interface UpdatePackInput {
  name?: string;
  description?: string | null;
}
