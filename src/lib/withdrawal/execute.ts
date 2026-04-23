import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'

export interface WithdrawalInput {
  userId: number
  reasonCode?: string | null
  reasonText?: string | null
}

/**
 * Phase 1: synchronous anonymization. Runs inside a single transaction.
 * After this returns, the User's personal info is destroyed, their OAuth
 * accounts are unlinked, and a withdrawal_jobs row exists for Phase 2.
 */
export async function executeWithdrawalPhase1(input: WithdrawalInput): Promise<{ jobId: number }> {
  const { userId, reasonCode, reasonText } = input
  // Random token — NOT the userId. Exposing userId in the public-facing
  // nickname would leak the user's approximate signup order/timing on every
  // post/comment they ever wrote, and that's a weak re-identification
  // vector. Admins can still cross-reference withdrawal_jobs.userId with
  // the User row's anonymized nickname internally.
  const token = crypto.randomBytes(8).toString('hex').slice(0, 12)
  const anonEmail = `deleted_${token}@deleted.local`
  const anonNickname = `탈퇴한회원_${token.slice(0, 6)}`

  return await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        nickname: anonNickname,
        name: null,
        phone: null,
        image: null,
        password: null,
        provider: null,
        providerId: null,
        emailVerified: null,
        lastLoginIp: null,
        status: 'withdrawn',
        deletedAt: new Date(),
      },
    })
    await tx.account.deleteMany({ where: { userId } })
    const job = await tx.withdrawalJob.create({
      data: {
        userId,
        status: 'pending',
        reasonCode: reasonCode || null,
        reasonText: reasonText || null,
      },
    })
    return { jobId: job.id }
  })
}

const BATCH_SIZE = 500

function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

async function deleteBatched(model: string, field: string, userId: number): Promise<number> {
  const accessor = prismaAccessor(model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (prisma as any)[accessor]
  if (!client || typeof client.deleteMany !== 'function') return 0
  let totalDeleted = 0
  // deleteMany with a LIMIT isn't natively supported by Prisma on MySQL; we
  // issue it in a loop with findMany+deleteMany to keep batches bounded.
  // If findMany returns fewer than BATCH_SIZE rows, we're done.
  while (true) {
    const rows: Array<{ id: number }> = await client.findMany({
      where: { [field]: userId },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    const ids = rows.map(r => r.id)
    const res = await client.deleteMany({ where: { id: { in: ids } } })
    totalDeleted += res.count
    if (rows.length < BATCH_SIZE) break
  }
  return totalDeleted
}

/**
 * Phase 2: asynchronous cleanup. Iterates the policy manifest and deletes
 * rows for each `policy='delete'` entry. Idempotent — safe to re-run.
 * Invokes `custom` handlers via dynamic plugin import.
 */
export async function executeWithdrawalPhase2(jobId: number): Promise<void> {
  const job = await prisma.withdrawalJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error(`withdrawal job ${jobId} not found`)
  if (job.status === 'done') return

  await prisma.withdrawalJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  try {
    for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
      for (const entry of entries) {
        if (entry.policy === 'delete') {
          await deleteBatched(entry.model, userField(entry), job.userId)
        } else if (entry.policy === 'custom') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modPath = plugin === 'core' ? `@/lib/withdrawal/handlers` : `@/plugins/${plugin}/cleanup`
          const mod = await import(/* webpackIgnore: true */ modPath)
          const handler = (mod as Record<string, unknown>)[entry.handler]
          if (typeof handler !== 'function') {
            throw new Error(`Plugin '${plugin}' custom handler '${entry.handler}' not exported`)
          }
          await (handler as (userId: number) => Promise<void>)(job.userId)
        }
      }
    }
    await prisma.withdrawalJob.update({
      where: { id: jobId },
      data: { status: 'done', completedAt: new Date(), lastError: null },
    })
  } catch (err) {
    await prisma.withdrawalJob.update({
      where: { id: jobId },
      data: { status: 'failed', lastError: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}
