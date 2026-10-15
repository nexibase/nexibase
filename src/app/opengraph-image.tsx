import { ImageResponse } from 'next/og'
import { loadSiteSettings } from '@/lib/site-settings'
import { prisma } from '@/lib/prisma'
import { isNexibaseProfile, plainDescription } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const alt = 'Site preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const settings = await loadSiteSettings()
  const home = await prisma.widgetPage.findUnique({ where: { slug: '' }, select: { widgets: { where: { isActive: true }, select: { widgetKey: true } } } })
  const product = isNexibaseProfile(settings.site_seo_profile, home?.widgets.map(widget => widget.widgetKey) ?? [])
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: 80, color: '#f8fafc', background: 'linear-gradient(135deg, #0f172a, #164e63)' }}>
      <div style={{ display: 'flex', fontSize: 78, fontWeight: 700 }}>{settings.site_name}</div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 32, color: '#a5f3fc' }}>{product ? 'Next.js · JavaScript · TypeScript' : plainDescription(settings.site_description, 110)}</div>
      {product && <div style={{ display: 'flex', marginTop: 18, fontSize: 28, color: '#cbd5e1' }}>Community · Content · Commerce CMS</div>}
    </div>, size,
  )
}
