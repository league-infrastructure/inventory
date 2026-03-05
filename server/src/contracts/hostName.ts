export interface HostNameRecord {
  id: number;
  name: string;
  computerId: number | null;
  computer: { id: number; model: string | null; serialNumber: string | null } | null;
}

export interface CreateHostNameInput {
  name: string;
}
