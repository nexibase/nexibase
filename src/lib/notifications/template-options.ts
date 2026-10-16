export type AligoTemplate = {
  code: string; name: string; content: string; status: string; approval: string
  buttons: { button: Record<string, string>[] } | null
}
export const usableAligoTemplate = (template: AligoTemplate) => template.approval === 'APR' && template.status === 'A'
export function aligoTemplateLabel(template: AligoTemplate) {
  if (usableAligoTemplate(template)) return template.name
  const approval = ({ APR: '승인됨', REG: '등록', REQ: '심사 중', REJ: '반려' } as Record<string, string>)[template.approval] || '승인 확인 필요'
  const status = ({ A: '정상', S: '중단', R: '대기' } as Record<string, string>)[template.status] || '상태 확인 필요'
  return `${template.name} (${approval} · ${status})`
}
export function projectAligoTemplates(rows: Record<string, unknown>[]): AligoTemplate[] {
  return rows.filter(row => row && typeof row.templtCode === 'string' && /^[a-z0-9_-]{1,100}$/i.test(row.templtCode)
    && typeof row.templtName === 'string' && typeof row.templtContent === 'string').map(row => {
    const buttonFields = ['name', 'linkType', 'linkTypeName', 'linkMo', 'linkPc', 'linkIos', 'linkAnd']
    const buttons = Array.isArray(row.buttons) ? row.buttons.filter(button => button && typeof button === 'object').map(button =>
      Object.fromEntries(buttonFields.filter(key => typeof button[key] === 'string').map(key => [key, button[key] as string]))) : []
    return {
      code: row.templtCode as string, name: row.templtName as string, content: row.templtContent as string,
      status: typeof row.status === 'string' ? row.status : '', approval: typeof row.inspStatus === 'string' ? row.inspStatus : '',
      buttons: buttons.length ? { button: buttons } : null,
    }
  })
}
