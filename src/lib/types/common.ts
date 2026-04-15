// Shared type definitions

// API response type — uses unknown instead of any
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  error?: string
  data?: T
}

// Pagination type
export interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

// Basic CRUD interface
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}

// Sort option
export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}
