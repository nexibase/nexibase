import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'

export interface PreviewRow {
  plugin: string
  model: string
  count: number
  reason?: string
  retentionYears?: number
}

export interface WithdrawalPreview {
  toDelete: PreviewRow[]
  toRetainAnonymized: PreviewRow[]
  toRetainLegal: PreviewRow[]
}

// Maps model name (as declared in the policy) to the Prisma client accessor
// (camelCase with initial lowercase). Example: 'OrderActivity' -> 'orderActivity'.
function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

async function countForEntry(userId: number, entry: WithdrawalPolicyEntry): Promise<number> {
  const accessor = prismaAccessor(entry.model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (prisma as any)[accessor]
  if (!client || typeof client.count !== 'function') return 0
  const field = userField(entry)
  try {
    return await client.count({ where: { [field]: userId } })
  } catch {
    // If the field doesn't exist (e.g., 'retain-via-parent' models),
    // the count would throw. Return 0 — these rows are counted via their parent.
    return 0
  }
}

function isLegalRetention(entry: WithdrawalPolicyEntry): number | null {
  // Orders are retained 5 years under 전자상거래법. This is the only legally-mandated
  // retention at present; extend here if more plugins add legal-retention models.
  if (entry.model === 'Order') return 5
  return null
}

export async function buildWithdrawalPreview(userId: number): Promise<WithdrawalPreview> {
  const preview: WithdrawalPreview = { toDelete: [], toRetainAnonymized: [], toRetainLegal: [] }

  for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
    for (const entry of entries) {
      // Skip retain-via-parent: their count is represented by the parent row.
      if (entry.policy === 'retain-via-parent') continue
      // For 'custom', count via parent rule may not apply; the handler may be complex.
      // For preview we display the parent model's count only; custom models are
      // out-of-preview and shown in admin audit page instead.
      if (entry.policy === 'custom') continue

      const count = await countForEntry(userId, entry)
      if (count === 0) continue

      const row: PreviewRow = { plugin, model: entry.model, count, reason: entry.reason }
      const legalYears = isLegalRetention(entry)

      if (entry.policy === 'delete') {
        preview.toDelete.push(row)
      } else if (legalYears !== null) {
        preview.toRetainLegal.push({ ...row, retentionYears: legalYears })
      } else {
        preview.toRetainAnonymized.push(row)
      }
    }
  }
  return preview
}
