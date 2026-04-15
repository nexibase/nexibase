// Auth-related type definitions

export interface JWTPayload {
  id: string;
  email: string;
  name: string | null;
  nickname: string;
  role: string;
  image: string | null;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    nickname: string;
    role: string;
    image: string | null;
  };
}
