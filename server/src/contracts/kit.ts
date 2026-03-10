import { PackRecord } from './pack';

export type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL' | 'PENCIL_BOX';

export const CONTAINER_TYPES: ContainerType[] = ['BAG', 'LARGE_TOTE', 'SMALL_TOTE', 'DUFFEL', 'PENCIL_BOX'];

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
  PENCIL_BOX: 'Pencil Box',
};

export interface KitRecord {
  id: number;
  number: number;
  containerType: ContainerType;
  name: string;
  description: string | null;
  status: string;
  qrCode: string | null;
  siteId: number | null;
  custodianId: number | null;
  imageId: number | null;
  categoryId: number | null;
  createdAt: string;
  updatedAt: string;
  lastInventoried: string | null;
  site: { id: number; name: string } | null;
  custodian: { id: number; displayName: string } | null;
  category: { id: number; name: string } | null;
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
  number: number;
  containerType?: ContainerType;
  name: string;
  description?: string | null;
  siteId?: number | null;
}

export interface UpdateKitInput {
  number?: number;
  containerType?: ContainerType;
  name?: string;
  description?: string | null;
  siteId?: number;
  categoryId?: number | null;
  custodianId?: number | null;
  status?: string;
}
