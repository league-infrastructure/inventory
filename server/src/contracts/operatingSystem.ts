export interface OperatingSystemRecord {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOperatingSystemInput {
  name: string;
}

export interface UpdateOperatingSystemInput {
  name?: string;
}
