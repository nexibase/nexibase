export type FaqActivityKind = 'views' | 'helpful' | 'notHelpful'
export type FaqActivityAudience = 'all' | 'user' | 'guest'
export interface FaqActivityDetails {
  faq: { id: number; question: string }
  kind: FaqActivityKind
  totals: { aggregate: number; recorded: number; user: number; guest: number; historical: number }
  pagination: { page: number; pageSize: number; total: number }
  records: {
    id: number
    occurredAt: string
    actor: { type: 'user'; user: { id: number; nickname: string; status: string } } | { type: 'guest'; label: string }
  }[]
}
