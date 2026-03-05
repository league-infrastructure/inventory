export interface ItemRecord {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
  packId: number;
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
