import { Prisma } from '@prisma/client'

export function validateNotificationRules(input: unknown, known: string[]) {
  if (!Array.isArray(input) || input.length > 100) throw new Error('이벤트 설정 형식을 확인하세요.')
  return input.map((rule: Record<string, unknown>) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('이벤트 설정 형식을 확인하세요.')
    if (typeof rule.eventType !== 'string' || !known.includes(rule.eventType)) throw new Error('등록되지 않은 알림 이벤트입니다.')
    for (const key of ['emailEnabled', 'smsEnabled', 'alimtalkEnabled']) if (typeof rule[key] !== 'boolean') throw new Error('이벤트 채널 설정 형식을 확인하세요.')
    for (const key of ['smsTemplate', 'alimtalkTemplate', 'alimtalkCode']) if (typeof rule[key] !== 'string' || (rule[key] as string).length > (key === 'alimtalkCode' ? 100 : 4000)) throw new Error('템플릿 길이를 확인하세요.')
    if (rule.alimtalkEnabled && (!rule.alimtalkCode || !rule.alimtalkTemplate)) throw new Error('알림톡을 켜려면 승인된 템플릿 코드와 본문이 필요합니다.')
    const mapping = rule.variableMapping || {}
    if (typeof mapping !== 'object' || Array.isArray(mapping) || Object.entries(mapping).some(([k,v]) => ['__proto__', 'constructor', 'prototype'].includes(k) || typeof v !== 'string' || k.length > 100 || v.length > 100)) throw new Error('템플릿 변수 매핑 형식을 확인하세요.')
    if (JSON.stringify(rule.alimtalkButtons ?? null).length > 10000) throw new Error('알림톡 버튼 정보가 너무 깁니다.')
    if (rule.alimtalkButtons != null && (typeof rule.alimtalkButtons !== 'object' || Array.isArray(rule.alimtalkButtons))) throw new Error('알림톡 버튼 정보는 JSON 객체로 입력하세요.')
    return { eventType: String(rule.eventType), data: {
      emailEnabled: rule.emailEnabled as boolean, smsEnabled: rule.smsEnabled as boolean, alimtalkEnabled: rule.alimtalkEnabled as boolean,
      smsTemplate: rule.smsTemplate as string, alimtalkCode: rule.alimtalkCode as string, alimtalkTemplate: rule.alimtalkTemplate as string,
      alimtalkButtons: rule.alimtalkButtons == null ? Prisma.DbNull : JSON.parse(JSON.stringify(rule.alimtalkButtons)), variableMapping: JSON.parse(JSON.stringify(mapping)),
    } }
  })
}
