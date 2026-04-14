// 회원 관련 타입 정의

// 기본 회원 정보 (데이터베이스에서 가져오는 전체 정보)
export interface Member {
  mb_no: number
  mb_id: string
  mb_password?: string // 보안상 API 응답에서는 제외
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
  // 편집 시에만 필요한 추가 필드들
  mb_ip?: string
  mb_nick_date?: string
  mb_open_date?: string
  mb_signature?: string
  mb_memo?: string
  mb_lost_certify?: string
  mb_profile?: string
}

// 회원 생성 폼 데이터 (새 회원 추가 시)
export interface MemberCreateForm {
  mb_id: string
  mb_password: string
  mb_password_confirm?: string // 클라이언트 측 검증용
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

// 회원 수정 폼 데이터 (회원 정보 수정 시)
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
  mb_password?: string // 선택적 비밀번호 변경
  mb_intercept_date: string
  mb_leave_date: string
  mb_email_certify: string
}

// 회원 목록에서 사용하는 간소화된 회원 정보
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
  selected?: boolean // UI 선택 상태
}

// 회원 통계 정보
export interface MemberStats {
  totalMembers: number
  blockedMembers: number
  withdrawnMembers: number
}

// 회원 API 응답 타입
export interface MemberApiResponse {
  member?: Member
  members?: Member[]
  stats?: MemberStats
}

// 검색 필터 타입
export interface MemberSearchFilter {
  searchType: 'userId' | 'name' | 'nickname' | 'email'
  searchValue: string
  filter: 'all' | 'total' | 'blocked' | 'withdrawn'
}

// 중복 검사 상태 타입
export interface DuplicateCheckStatus {
  available: boolean | null
  message: string
  checking: boolean
}

// 통합 회원 폼 데이터 (생성/수정 공통)
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

// 폼 모드 타입
export type MemberFormMode = 'create' | 'edit'

// 폼 Props 타입
export interface MemberFormProps {
  mode: MemberFormMode
  memberId?: string // edit 모드일 때만 필요
  onCancel: () => void
  onSuccess: () => void
} 