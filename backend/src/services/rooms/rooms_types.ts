export interface CreateRoomRequest {
  room_number: string;
  type: 'Single' | 'Double' | 'Suite';
  status?: 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service';
  price_per_night: number;
  floor: number;
  features?: string[];
  description?: string;
}

export interface UpdateRoomRequest {
  room_number?: string;
  type?: 'Single' | 'Double' | 'Suite';
  status?: 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service';
  price_per_night?: number;
  floor?: number;
  features?: string[];
  description?: string;
}

export interface UpdateHousekeepingRequest {
  status: 'Clean' | 'Dirty' | 'In Progress';
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  notes?: string;
}

export interface RoomResponse {
  id: string;
  room_number: string;
  type: string;
  status: string;
  price_per_night: number;
  floor: number;
  features: string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface HousekeepingResponse {
  id: string;
  room_id: string;
  status: string;
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  last_cleaned?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

