export interface TransferRecord {
  id: number;
  objectType: 'Kit' | 'Computer';
  objectId: number;
  userId: number;
  fromCustodian: string | null;
  toCustodian: string | null;
  fromSiteId: number | null;
  toSiteId: number | null;
  notes: string | null;
  createdAt: string;
  user: { id: number; displayName: string };
  fromSite?: { id: number; name: string } | null;
  toSite?: { id: number; name: string } | null;
}

export interface CreateTransferInput {
  objectType: 'Kit' | 'Computer';
  objectId: number;
  custodianId?: number | null;
  siteId?: number | null;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
}
