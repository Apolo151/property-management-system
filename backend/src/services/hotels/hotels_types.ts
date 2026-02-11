// src/services/hotels/hotels_types.ts

export interface Hotel {
  id: string;
  hotel_name: string;
  hotel_address: string | null;
  hotel_city: string | null;
  hotel_state: string | null;
  hotel_country: string | null;
  hotel_postal_code: string | null;
  hotel_phone: string | null;
  hotel_email: string | null;
  hotel_website: string | null;
  hotel_logo_url: string | null;
  currency: string;
  timezone: string;
  date_format: string;
  time_format: string;
  check_in_time: string;
  check_out_time: string;
  tax_percentage: number;
  // Channel manager settings
  active_channel_manager: string | null;
  beds24_property_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HotelResponse extends Omit<Hotel, 'deleted_at'> {}

export interface CreateHotelRequest {
  hotel_name: string;
  hotel_address?: string;
  hotel_city?: string;
  hotel_state?: string;
  hotel_country?: string;
  hotel_postal_code?: string;
  hotel_phone?: string;
  hotel_email?: string;
  hotel_website?: string;
  hotel_logo_url?: string;
  currency?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  check_in_time?: string;
  check_out_time?: string;
  tax_percentage?: number;
  active_channel_manager?: string | null;
  beds24_property_id?: string | null;
}

export interface UpdateHotelRequest {
  hotel_name?: string;
  hotel_address?: string;
  hotel_city?: string;
  hotel_state?: string;
  hotel_country?: string;
  hotel_postal_code?: string;
  hotel_phone?: string;
  hotel_email?: string;
  hotel_website?: string;
  hotel_logo_url?: string;
  currency?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  check_in_time?: string;
  check_out_time?: string;
  tax_percentage?: number;
  active_channel_manager?: string | null;
  beds24_property_id?: string | null;
}

