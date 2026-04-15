// Member-related type definitions

// Complete member record (as returned from the database)
export interface Member {
  mb_no: number
  mb_id: string
  mb_password?: string // omitted from API responses for security
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_hp: string
  mb_tel: string
  mb_level: number
  mb_certify: string
  mb_adult: number
  mb_mailling: number
  mb_sms: number
  mb_open: number
  mb_point: number
  mb_today_login: string
  mb_datetime: string
  mb_leave_date: string
  mb_intercept_date: string
  mb_email_certify: string
  // Extra fields required only when editing
  mb_ip?: string
  mb_nick_date?: string
  mb_open_date?: string
  mb_signature?: string
  mb_memo?: string
  mb_lost_certify?: string
  mb_profile?: string
}

// Form data for creating a member
export interface MemberCreateForm {
  mb_id: string
  mb_password: string
  mb_password_confirm?: string // client-side validation only
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_hp: string
  mb_tel: string
  mb_level: number
  mb_certify: string
  mb_adult: number
  mb_mailling: number
  mb_sms: number
  mb_open: number
  mb_point: number
}

// Form data for updating a member
export interface MemberUpdateForm {
  mb_id: string
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_hp: string
  mb_tel: string
  mb_level: number
  mb_certify: string
  mb_adult: number
  mb_mailling: number
  mb_sms: number
  mb_open: number
  mb_point: number
  mb_password?: string // optional password change
  mb_intercept_date: string
  mb_leave_date: string
  mb_email_certify: string
}

// Slim member representation for list views
export interface MemberListItem {
  mb_no: number
  mb_id: string
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_hp: string
  mb_tel: string
  mb_level: number
  mb_point: number
  mb_datetime: string
  mb_today_login: string
  mb_leave_date: string
  mb_intercept_date: string
  mb_certify: string
  mb_email_certify: string
  mb_sms: number
  mb_open: number
  mb_adult: number
  mb_mailling: number
  selected?: boolean // UI selection state
}

// Member statistics
export interface MemberStats {
  totalMembers: number
  blockedMembers: number
  withdrawnMembers: number
}

// Member API response type
export interface MemberApiResponse {
  member?: Member
  members?: Member[]
  stats?: MemberStats
}

// Search filter type
export interface MemberSearchFilter {
  searchType: 'userId' | 'name' | 'nickname' | 'email'
  searchValue: string
  filter: 'all' | 'total' | 'blocked' | 'withdrawn'
}

// Duplicate-check status type
export interface DuplicateCheckStatus {
  available: boolean | null
  message: string
  checking: boolean
}

// Unified member form data (shared between create and edit)
export interface MemberFormData {
  mb_id: string
  mb_password: string
  mb_password_confirm?: string
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_hp: string
  mb_tel: string
  mb_level: number
  mb_certify: string
  mb_adult: number
  mb_mailling: number
  mb_sms: number
  mb_open: number
  mb_point: number
  mb_homepage: string
  mb_zip: string
  mb_addr1: string
  mb_addr2: string
  mb_addr3: string
  mb_signature: string
  mb_memo: string
  mb_profile: string
  mb_icon: string
  mb_leave_date: string
  mb_intercept_date: string
  mb_1: string
  mb_2: string
  mb_3: string
  mb_4: string
  mb_5: string
  mb_6: string
  mb_7: string
  mb_8: string
  mb_9: string
  mb_10: string
}

// Form mode
export type MemberFormMode = 'create' | 'edit'

// Form component props
export interface MemberFormProps {
  mode: MemberFormMode
  memberId?: string // required only in edit mode
  onCancel: () => void
  onSuccess: () => void
}
