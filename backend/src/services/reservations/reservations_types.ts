// Beds24 status enum
export type Beds24Status = 'confirmed' | 'request' | 'new' | 'cancelled' | 'black' | 'inquiry' | 'checkedin' | 'checkedout';

// Beds24 sub status enum
export type Beds24SubStatus =
  | 'actionRequired'
  | 'allotment'
  | 'cancelledByGuest'
  | 'cancelledByHost'
  | 'noShow'
  | 'waitlist'
  | 'walkin'
  | 'none'
  | 'nonPayment';

// Legacy PMS status (for backward compatibility)
export type LegacyReservationStatus = 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled';

export interface CreateReservationRequest {
  room_id?: string; // Legacy: individual room (backward compatibility)
  room_type_id?: string; // New: room type (Beds24-style)
  assigned_unit_id?: string; // Optional: specific unit if needed
  units_requested?: number; // Number of units requested (default: 1)
  primary_guest_id: string;
  secondary_guest_id?: string;
  check_in: string; // ISO date string
  check_out: string; // ISO date string
  status?: LegacyReservationStatus; // Legacy status
  source?: 'Direct' | 'Beds24' | 'Booking.com' | 'Expedia' | 'Other';
  special_requests?: string;
  force?: boolean; // Allow creating reservation even if there's an overlap
  
  // Beds24-compatible fields
  beds24_master_id?: number | null;
  beds24_booking_group?: { master?: number; ids?: number[] } | null;
  beds24_unit_id?: number | null;
  room_qty?: number;
  sub_status?: Beds24SubStatus | null;
  status_code?: number | null;
  num_adult?: number | null;
  num_child?: number | null;
  country?: string | null;
  country2?: string | null;
  arrival_time?: string | null;
  comments?: string | null;
  notes?: string | null;
  message?: string | null;
  group_note?: string | null;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
  custom5?: string | null;
  custom6?: string | null;
  custom7?: string | null;
  custom8?: string | null;
  custom9?: string | null;
  custom10?: string | null;
  flag_color?: string | null;
  flag_text?: string | null;
  channel?: string | null;
  api_source?: string | null;
  api_source_id?: number | null;
  api_reference?: string | null;
  referer?: string | null;
  reference?: string | null;
  lang?: string | null;
  voucher?: string | null;
  deposit?: number | null;
  tax?: number | null;
  commission?: number | null;
  rate_description?: string | null;
  offer_id?: number | null;
  allow_channel_update?: 'none' | 'all' | 'allExceptRoomChange' | null;
  allow_auto_action?: 'disable' | 'enable' | null;
  allow_review?: 'default' | 'disable' | 'enable' | null;
  allow_cancellation?: {
    type: 'propertyDefault' | 'never' | 'always' | 'daysBeforeArrival';
    daysBeforeArrivalValue?: number | null;
  } | null;
  invoice_items?: Array<{
    invoiceId?: number | null;
    subType?: number;
    [key: string]: any;
  }> | null;
  info_items?: Array<{
    id?: number;
    bookingId?: number;
    createTime?: string;
    code?: string;
    text?: string;
    [key: string]: any;
  }> | null;
}

export interface UpdateReservationRequest {
  room_id?: string;
  check_in?: string;
  check_out?: string;
  status?: LegacyReservationStatus;
  special_requests?: string;
  
  // Beds24-compatible fields (all optional for updates)
  beds24_master_id?: number | null;
  beds24_booking_group?: { master?: number; ids?: number[] } | null;
  beds24_unit_id?: number | null;
  room_qty?: number;
  sub_status?: Beds24SubStatus | null;
  status_code?: number | null;
  num_adult?: number | null;
  num_child?: number | null;
  country?: string | null;
  country2?: string | null;
  arrival_time?: string | null;
  comments?: string | null;
  notes?: string | null;
  message?: string | null;
  group_note?: string | null;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
  custom5?: string | null;
  custom6?: string | null;
  custom7?: string | null;
  custom8?: string | null;
  custom9?: string | null;
  custom10?: string | null;
  flag_color?: string | null;
  flag_text?: string | null;
  channel?: string | null;
  api_source?: string | null;
  api_source_id?: number | null;
  api_reference?: string | null;
  referer?: string | null;
  reference?: string | null;
  lang?: string | null;
  voucher?: string | null;
  deposit?: number | null;
  tax?: number | null;
  commission?: number | null;
  rate_description?: string | null;
  offer_id?: number | null;
  allow_channel_update?: 'none' | 'all' | 'allExceptRoomChange' | null;
  allow_auto_action?: 'disable' | 'enable' | null;
  allow_review?: 'default' | 'disable' | 'enable' | null;
  allow_cancellation?: {
    type: 'propertyDefault' | 'never' | 'always' | 'daysBeforeArrival';
    daysBeforeArrivalValue?: number | null;
  } | null;
  invoice_items?: Array<any> | null;
  info_items?: Array<any> | null;
}

export interface ReservationResponse {
  id: string;
  room_id?: string | null; // Legacy: individual room (nullable for room types)
  room_type_id?: string | null; // New: room type (nullable for legacy rooms)
  room_number?: string | null; // Legacy room number or room type name
  room_type_name?: string | null; // Room type name
  assigned_unit_id?: string | null; // Assigned unit ID if applicable
  units_requested?: number; // Number of units requested
  primary_guest_id: string;
  primary_guest_name: string;
  primary_guest_email: string;
  primary_guest_phone: string;
  secondary_guest_id?: string;
  secondary_guest_name?: string;
  secondary_guest_email?: string;
  secondary_guest_phone?: string;
  check_in: string;
  check_out: string;
  status: string; // Legacy status
  total_amount: number;
  source: string;
  beds24_booking_id?: string;
  special_requests?: string;
  
  // Beds24-compatible fields
  beds24_master_id?: number | null;
  beds24_booking_group?: { master?: number; ids?: number[] } | null;
  beds24_unit_id?: number | null;
  room_qty?: number | null;
  sub_status?: string | null;
  status_code?: number | null;
  num_adult?: number | null;
  num_child?: number | null;
  country?: string | null;
  country2?: string | null;
  arrival_time?: string | null;
  booking_time?: string | null;
  modified_time?: string | null;
  cancel_time?: string | null;
  comments?: string | null;
  notes?: string | null;
  message?: string | null;
  group_note?: string | null;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
  custom5?: string | null;
  custom6?: string | null;
  custom7?: string | null;
  custom8?: string | null;
  custom9?: string | null;
  custom10?: string | null;
  flag_color?: string | null;
  flag_text?: string | null;
  channel?: string | null;
  api_source?: string | null;
  api_source_id?: number | null;
  api_reference?: string | null;
  referer?: string | null;
  reference?: string | null;
  lang?: string | null;
  voucher?: string | null;
  deposit?: number | null;
  tax?: number | null;
  commission?: number | null;
  rate_description?: string | null;
  offer_id?: number | null;
  allow_channel_update?: string | null;
  allow_auto_action?: string | null;
  allow_review?: string | null;
  allow_cancellation?: {
    type: string;
    daysBeforeArrivalValue?: number | null;
  } | null;
  invoice_items?: Array<any> | null;
  info_items?: Array<any> | null;
  
  created_at: string;
  updated_at: string;
}

export interface ReservationWithGuests {
  reservation: ReservationResponse;
  guests: Array<{
    guest_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    guest_type: 'Primary' | 'Secondary';
  }>;
}

