export interface IssueRecord {
  id: number;
  type: string;
  status: string;
  packId: number | null;
  itemId: number | null;
  kitId: number | null;
  computerId: number | null;
  reporterId: number;
  resolverId: number | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pack: { id: number; name: string } | null;
  item: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
  computer: { id: number; model: string | null; serialNumber: string | null } | null;
  reporter: { id: number; displayName: string };
  resolver: { id: number; displayName: string } | null;
}

export interface CreateIssueInput {
  type: string;
  packId?: number;
  itemId?: number;
  kitId?: number;
  computerId?: number;
  notes?: string;
}

export interface ResolveIssueInput {
  notes?: string;
}
