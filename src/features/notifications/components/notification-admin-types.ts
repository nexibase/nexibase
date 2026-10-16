import type { VariableMapping } from '@/lib/notifications/template-variables'

export type NotificationRuleEditor = { eventType: string; label: string; owner: string; emailEnabled: boolean; smsEnabled: boolean; alimtalkEnabled: boolean; smsTemplate: string; alimtalkCode: string; alimtalkTemplate: string; alimtalkButtons: unknown; variableMapping: VariableMapping; buttonsText: string }
