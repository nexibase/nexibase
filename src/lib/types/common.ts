// 공통 타입 정의

// API 응답 타입 - any 대신 unknown 사용
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  error?: string
  data?: T
}

// 페이지네이션 타입
export interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

// 기본 CRUD 인터페이스
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}

// 정렬 옵션
export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
} 