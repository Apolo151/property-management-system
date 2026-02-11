export interface HotelSettingsResponse {
  id: string;
  hotel_name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  tax_rate: number;
  currency: string;
  timezone: string;
  check_in_time: string;
  check_out_time: string;
  beds24_hotel_id?: number | null;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UpdateHotelSettingsRequest {
  hotel_name?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  tax_rate?: number;
  currency?: string;
  timezone?: string;
  check_in_time?: string;
  check_out_time?: string;
  beds24_hotel_id?: number | null;
  settings?: Record<string, any>;
}

