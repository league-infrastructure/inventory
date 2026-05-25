export interface ManufacturerRecord {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateManufacturerInput {
  name: string;
}

export interface UpdateManufacturerInput {
  name?: string;
}
