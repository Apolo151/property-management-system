export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'VIEWER';

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active?: boolean;
  hotel_ids?: string[]; // Hotels to assign the user to
}

export interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string; // Optional password update
  hotel_ids?: string[]; // Hotels to assign the user to
}

export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  hotel_ids?: string[]; // Hotels the user has access to
}

