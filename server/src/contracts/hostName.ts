export interface HostNameRecord {
  id: number;
  name: string;
  scheme: string | null;
  computerId: number | null;
  computer: { id: number; model: string | null; serialNumber: string | null } | null;
}

export interface CreateHostNameInput {
  name: string;
  scheme?: string | null;
}

export interface UpdateHostNameInput {
  name?: string;
  scheme?: string | null;
}
