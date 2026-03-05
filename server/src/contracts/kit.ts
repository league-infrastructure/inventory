import { PackRecord } from './pack';

export interface KitRecord {
  id: number;
  name: string;
  description: string | null;
  status: string;
  qrCode: string | null;
  siteId: number;
  createdAt: string;
  updatedAt: string;
  site: { id: number; name: string };
}

export interface KitDetailRecord extends KitRecord {
  packs: PackRecord[];
  computers: {
    id: number;
    serialNumber: string | null;
    model: string | null;
    hostName: { id: number; name: string; computerId: number | null } | null;
  }[];
}

export interface CreateKitInput {
  name: string;
  description?: string | null;
  siteId: number;
}

export interface UpdateKitInput {
  name?: string;
  description?: string | null;
  siteId?: number;
}
