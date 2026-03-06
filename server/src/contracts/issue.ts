export interface IssueRecord {
  id: number;
  type: string;
  status: string;
  packId: number;
  itemId: number;
  reporterId: number;
  resolverId: number | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pack: { id: number; name: string };
  item: { id: number; name: string };
  reporter: { id: number; displayName: string };
  resolver: { id: number; displayName: string } | null;
}

export interface CreateIssueInput {
  type: string;
  packId: number;
  itemId: number;
  notes?: string;
}

export interface ResolveIssueInput {
  notes?: string;
}
