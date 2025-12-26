export interface CreateGuestRequest {
  name: string;
  email?: string;
  phone?: string;
  past_stays?: number;
  notes?: string;
}

export interface UpdateGuestRequest {
  name?: string;
  email?: string;
  phone?: string;
  past_stays?: number;
  notes?: string;
}

export interface GuestResponse {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  past_stays: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

