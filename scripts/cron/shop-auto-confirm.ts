import { prisma } from '../../src/lib/prisma'
import { logActivity } from '../../src/plugins/shop/fulfillment/activities'
import { getShopSetting } from '../../src/plugins/shop/lib/shop-settings'

async function main() {
  const daysStr = (await getShopSetting('default_confirm_days')) ?? '7'
  const days = Number(daysStr)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const eligible = await prisma.order.findMany({
    where: { status: 'delivered', deliveredAt: { lte: cutoff } },
    select: { id: true, status: true },
  })
  console.log(`[auto-confirm] ${eligible.length} orders eligible (cutoff=${cutoff.toISOString()})`)
  for (const o of eligible) {
    await prisma.$transaction(async tx => {
      const updateRes = await tx.order.updateMany({
        where: { id: o.id, status: 'delivered' },
        data: { status: 'confirmed' },
      })
      if (updateRes.count === 0) {
        console.log(`[auto-confirm] order ${o.id} status changed during processing, skipping`)
        return
      }
      await logActivity(tx, {
        orderId: o.id, actorType: 'system', action: 'status_changed',
        fromStatus: o.status, toStatus: 'confirmed',
      })
    })
    console.log(`[auto-confirm] order ${o.id} → confirmed`)
  }
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
