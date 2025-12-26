export interface CreateReservationRequest {
  room_id: string;
  primary_guest_id: string;
  secondary_guest_id?: string;
  check_in: string; // ISO date string
  check_out: string; // ISO date string
  status?: 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled';
  source?: 'Direct' | 'Beds24' | 'Booking.com' | 'Expedia' | 'Other';
  special_requests?: string;
  force?: boolean; // Allow creating reservation even if there's an overlap
}

export interface UpdateReservationRequest {
  room_id?: string;
  check_in?: string;
  check_out?: string;
  status?: 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled';
  special_requests?: string;
}

export interface ReservationResponse {
  id: string;
  room_id: string;
  room_number: string;
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
  status: string;
  total_amount: number;
  source: string;
  beds24_booking_id?: string;
  special_requests?: string;
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

