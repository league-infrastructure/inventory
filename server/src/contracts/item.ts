export interface ItemRecord {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
  packId: number;
}

export interface ItemDetailRecord extends ItemRecord {
  pack: { id: number; name: string; kit: { id: number; name: string } };
}

export interface CreateItemInput {
  name: string;
  type: string;
  expectedQuantity?: number | null;
}

export interface UpdateItemInput {
  name?: string;
  type?: string;
  expectedQuantity?: number | null;
}
