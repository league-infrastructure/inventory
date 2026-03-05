export interface CheckoutRecord {
  id: number;
  kitId: number;
  userId: number;
  destinationSiteId: number;
  returnSiteId: number | null;
  checkedOutAt: string;
  checkedInAt: string | null;
  kit: { id: number; name: string; qrCode?: string | null };
  user: { id: number; displayName: string };
  destinationSite: { id: number; name: string };
  returnSite: { id: number; name: string } | null;
}

export interface CreateCheckoutInput {
  kitId: number;
  destinationSiteId: number;
}

export interface CheckinInput {
  returnSiteId: number;
}
