export interface InventoryCheckLineRecord {
  id: number;
  inventoryCheckId: number;
  objectType: string;
  objectId: number;
  expectedValue: string | null;
  actualValue: string | null;
  hasDiscrepancy: boolean;
  objectName?: string;
  packName?: string;
}

export interface InventoryCheckRecord {
  id: number;
  kitId: number | null;
  packId: number | null;
  userId: number;
  notes: string | null;
  createdAt: string;
  user: { id: number; displayName: string };
  kit?: { id: number; name: string } | null;
  pack?: { id: number; name: string } | null;
  lines: InventoryCheckLineRecord[];
  discrepancyCount?: number;
}

export interface SubmitInventoryCheckInput {
  notes?: string;
  lines: {
    id: number;
    actualValue: string;
  }[];
}
