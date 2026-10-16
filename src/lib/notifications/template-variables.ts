export type VariableMapping = Record<string, string>
export type TemplateVariableUse = 'alimtalk' | 'sms' | 'buttons'
export const BASE_VARIABLE_SOURCES = [
  { key: 'name', label: '회원 이름 / 닉네임', example: '홍길동' },
  { key: 'title', label: '알림 제목', example: '새 댓글이 등록되었습니다' },
  { key: 'message', label: '알림 내용', example: '작성한 게시글에 새 댓글이 달렸습니다.' },
  { key: 'link', label: '알림 상세 링크', example: 'https://example.com/posts/123' },
  { key: 'eventType', label: '이벤트 종류', example: 'post_comment' },
] as const
export const ORDER_VARIABLE_SOURCES = [
  { key: 'orderNo', label: '주문 번호', example: 'ORDER-20261016-001' },
  { key: 'status', label: '주문 상태', example: '배송 중' },
  { key: 'totalAmount', label: '주문 금액', example: '35000' },
  { key: 'trackingNumber', label: '운송장 번호', example: '123456789012' },
  { key: 'customerName', label: '주문자 이름', example: '홍길동' },
] as const
export function variableSources(eventType: string) {
  return eventType.startsWith('shop.') ? [...BASE_VARIABLE_SOURCES, ...ORDER_VARIABLE_SOURCES] : [...BASE_VARIABLE_SOURCES]
}
export function readVariableMapping(value: unknown): VariableMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, source]) => typeof source === 'string'))
}
export function templateVariables(input: { alimtalkTemplate: string; smsTemplate: string; buttonsText: string; variableMapping: VariableMapping }) {
  const variables = new Map<string, TemplateVariableUse[]>()
  for (const [use, text] of [['alimtalk', input.alimtalkTemplate], ['sms', input.smsTemplate], ['buttons', input.buttonsText]] as const) {
    for (const match of text.matchAll(/#\{([^}]+)\}/g)) {
      const uses = variables.get(match[1]) || []
      if (!uses.includes(use)) uses.push(use)
      variables.set(match[1], uses)
    }
  }
  // Retain saved aliases even when the selected template no longer references them.
  for (const name of Object.keys(input.variableMapping)) if (!variables.has(name)) variables.set(name, [])
  return Array.from(variables, ([name, uses]) => ({ name, uses }))
}
export function changeVariableMapping(mapping: VariableMapping, name: string, source: string): VariableMapping {
  const next = { ...mapping }
  if (source) Object.defineProperty(next, name, { value: source, enumerable: true, writable: true, configurable: true })
  else delete next[name]
  return next
}
