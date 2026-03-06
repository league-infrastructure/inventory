export interface ComputerCheckoutRecord {
  id: number;
  computerId: number;
  userId: number;
  destinationSiteId: number | null;
  returnSiteId: number | null;
  checkedOutAt: string;
  checkedInAt: string | null;
  computer: { id: number; model: string | null; qrCode: string | null };
  user: { id: number; displayName: string };
  destinationSite: { id: number; name: string } | null;
  returnSite: { id: number; name: string } | null;
}

export interface CreateComputerCheckoutInput {
  computerId: number;
  destinationSiteId?: number;
}

export interface ComputerCheckinInput {
  returnSiteId: number;
}
