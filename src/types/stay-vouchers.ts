export type StayVoucherStatus = "unclaimed" | "claimed" | "expired";
export type StayVoucherPaymentStatus = "pending" | "paid" | "failed";
export type StayVoucherPaymentMethod = "gcash" | "maya" | "card";

export interface StayVoucherBatch {
  id: string;
  listing_id: string;
  batch_name: string;
  nights: number;
  price_php: number;
  quantity: number;
  valid_days: number;
  terms: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface StayVoucherPurchase {
  id: string;
  batch_id: string;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  subtotal_php: number;
  payment_provider: string;
  payment_method: StayVoucherPaymentMethod;
  payment_ref: string | null;
  payment_status: StayVoucherPaymentStatus;
  success_token: string;
  created_at: string;
  paid_at: string | null;
}

export interface StayVoucherCode {
  id: string;
  batch_id: string;
  code: string;
  status: StayVoucherStatus;
  purchase_id: string;
  booking_id: string | null;
  valid_until: string;
  redeemed_by_host_id: string | null;
  redeemed_at: string | null;
  created_at: string;
}

export interface PlatformRevenueEvent {
  id: string;
  source: string;
  amount_php: number;
  stay_voucher_code_id: string | null;
  occurred_at: string;
}

export interface StayVoucherBatchWithListing extends StayVoucherBatch {
  listing: {
    id: string;
    title: string;
    city: string | null;
    hero_image_url: string | null;
  };
  unclaimed_count: number;
}
