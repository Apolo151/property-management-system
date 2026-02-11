export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  token: string;
  refreshToken?: string;
  hotels?: Array<{
    id: string;
    hotel_name: string;
  }>;
  activeHotelId?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

