import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface Backfill {
  boards: Array<{ id: number; nameEn: string; descriptionEn: string | null; nameKo: string; descriptionKo: string | null }>
  menus: Array<{ id: number; labelEn: string; labelKo: string }>
  widgets: Array<{ id: number; titleEn: string; titleKo: string }>
  contents: Array<{ id: number; titleEn: string; titleKo: string; contentEn: string; contentKo: string }>
  policies: Array<{ id: number; titleEn: string; titleKo: string; contentEn: string; contentKo: string }>
  settings: Array<{ key: string; valueEn: string; valueKo: string }>
}

async function main() {
  const dictPath = path.join(__dirname, 'backfill-translations.json')
  const dict: Backfill = JSON.parse(fs.readFileSync(dictPath, 'utf8'))

  console.log('--- Boards ---')
  for (const b of dict.boards) {
    await prisma.board.update({
      where: { id: b.id },
      data: { name: b.nameEn, description: b.descriptionEn },
    })
    await prisma.boardTranslation.upsert({
      where: { boardId_locale: { boardId: b.id, locale: 'ko' } },
      create: { boardId: b.id, locale: 'ko', name: b.nameKo, description: b.descriptionKo, source: 'manual' },
      update: { name: b.nameKo, description: b.descriptionKo, source: 'manual' },
    })
    console.log(`  #${b.id} ${b.nameKo} → ${b.nameEn}`)
  }

  console.log('--- Menus ---')
  for (const m of dict.menus) {
    await prisma.menu.update({ where: { id: m.id }, data: { label: m.labelEn } })
    await prisma.menuTranslation.upsert({
      where: { menuId_locale: { menuId: m.id, locale: 'ko' } },
      create: { menuId: m.id, locale: 'ko', label: m.labelKo, source: 'manual' },
      update: { label: m.labelKo, source: 'manual' },
    })
    console.log(`  #${m.id} ${m.labelKo} → ${m.labelEn}`)
  }

  console.log('--- HomeWidgets ---')
  for (const w of dict.widgets) {
    await prisma.homeWidget.update({ where: { id: w.id }, data: { title: w.titleEn } })
    await prisma.homeWidgetTranslation.upsert({
      where: { widgetId_locale: { widgetId: w.id, locale: 'ko' } },
      create: { widgetId: w.id, locale: 'ko', title: w.titleKo, source: 'manual' },
      update: { title: w.titleKo, source: 'manual' },
    })
    console.log(`  #${w.id} ${w.titleKo} → ${w.titleEn}`)
  }

  console.log('--- Contents ---')
  for (const c of dict.contents) {
    await prisma.content.update({
      where: { id: c.id },
      data: { title: c.titleEn, content: c.contentEn },
    })
    await prisma.contentTranslation.upsert({
      where: { contentId_locale: { contentId: c.id, locale: 'ko' } },
      create: { contentId: c.id, locale: 'ko', title: c.titleKo, content: c.contentKo, source: 'manual' },
      update: { title: c.titleKo, content: c.contentKo, source: 'manual' },
    })
    console.log(`  #${c.id} ${c.titleKo} → ${c.titleEn}`)
  }

  console.log('--- Policies ---')
  for (const p of dict.policies) {
    await prisma.policy.update({
      where: { id: p.id },
      data: { title: p.titleEn, content: p.contentEn },
    })
    await prisma.policyTranslation.upsert({
      where: { policyId_locale: { policyId: p.id, locale: 'ko' } },
      create: { policyId: p.id, locale: 'ko', title: p.titleKo, content: p.contentKo, source: 'manual' },
      update: { title: p.titleKo, content: p.contentKo, source: 'manual' },
    })
    console.log(`  #${p.id} ${p.titleKo} → ${p.titleEn}`)
  }

  console.log('--- Settings ---')
  for (const s of dict.settings) {
    await prisma.setting.update({ where: { key: s.key }, data: { value: s.valueEn } })
    await prisma.settingTranslation.upsert({
      where: { key_locale: { key: s.key, locale: 'ko' } },
      create: { key: s.key, locale: 'ko', value: s.valueKo, source: 'manual' },
      update: { value: s.valueKo, source: 'manual' },
    })
    console.log(`  ${s.key}: ${s.valueKo} → ${s.valueEn}`)
  }

  console.log('\n✅ Backfill complete')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
