export interface ComputerRecord {
  id: number;
  serialNumber: string | null;
  serviceTag: string | null;
  model: string | null;
  defaultUsername: string | null;
  defaultPassword: string | null;
  disposition: string;
  dateReceived: string | null;
  lastInventoried: string | null;
  notes: string | null;
  qrCode: string | null;
  siteId: number | null;
  kitId: number | null;
  osId: number | null;
  custodianId: number | null;
  createdAt: string;
  updatedAt: string;
  hostName: { id: number; name: string; computerId: number | null } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
  os: { id: number; name: string } | null;
  custodian: { id: number; displayName: string } | null;
}

export interface CreateComputerInput {
  serialNumber?: string | null;
  serviceTag?: string | null;
  model?: string | null;
  defaultUsername?: string | null;
  defaultPassword?: string | null;
  disposition?: string;
  dateReceived?: string | null;
  lastInventoried?: string | null;
  notes?: string | null;
  siteId?: number | null;
  kitId?: number | null;
  osId?: number | null;
  hostNameId?: number | null;
}

export interface UpdateComputerInput extends CreateComputerInput {}
