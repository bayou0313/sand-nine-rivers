// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).

export type PaymentType = "per_load" | "hourly" | "flat_day";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  truck_number: string | null;
  payment_type: PaymentType | string;
  payment_rate: number;
  license_expires_on: string | null; // ISO date
  notes: string | null;
  active: boolean;
  // Path B Phase 3a Slice 1.2 — derived server-side from !!pin_hash. Used to gate
  // "Set PIN" vs "Reset PIN" label in DriverModal. The bcrypt hash is never exposed to the client.
  pin_set?: boolean;
  created_at: string;
  updated_at: string;
}

export const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: "per_load", label: "Per Load" },
  { value: "hourly", label: "Hourly" },
  { value: "flat_day", label: "Flat Day" },
];
