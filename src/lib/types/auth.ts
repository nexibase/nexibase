// 인증 관련 타입 정의

export interface JWTPayload {
  mb_no: number;
  mb_id: string;
  mb_level: number;
  mb_email: string;
  mb_nick: string;
  mb_datetime: string;
  mb_today_login: string;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  mb_id: string;
  mb_password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
  member?: {
    mb_id: string;
    mb_name: string;
    mb_nick: string;
    mb_level: number;
  };
} 