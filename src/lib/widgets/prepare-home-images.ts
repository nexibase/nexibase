import 'server-only'
import path from 'node:path'
import { stat } from 'node:fs/promises'
import sharp from 'sharp'

// Only public raster uploads can enter the image optimizer. Never resolve
// arbitrary HTML URLs as server filesystem paths.
const UPLOAD = /^\/uploads\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/i
const widths = [384, 640, 750, 828, 1080, 1200]
const metadata = new Map<string, { mtime: number; width: number; height: number }>()

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(v => v !== undefined)
}

async function prepareHtml(html: string, sizes: string) {
  const tags = [...html.matchAll(/<img\b[^>]*>/gi)]
  const replacements = await Promise.all(tags.map(async ([original]) => {
    let tag = original
    const src = attribute(tag, 'src') || ''
    if (!/\salt\s*=/i.test(tag)) tag = tag.replace(/\s*\/?>$/, ' alt="본문 이미지">')
    if (!UPLOAD.test(src)) return [original, tag] as const
    try {
      const file = path.join(process.cwd(), 'public', src)
      const info = await stat(file)
      let dimensions = metadata.get(src)
      if (!dimensions || dimensions.mtime !== info.mtimeMs) {
        const image = await sharp(file).metadata()
        if (!image.width || !image.height || (image.pages || 1) > 1) return [original, tag] as const
        dimensions = { mtime: info.mtimeMs, width: image.width, height: image.height }
        if (metadata.size >= 128) metadata.clear()
        metadata.set(src, dimensions)
      }
      let attributes = ''
      if (!/\swidth\s*=/i.test(tag)) attributes += ` width="${dimensions.width}"`
      if (!/\sheight\s*=/i.test(tag)) attributes += ` height="${dimensions.height}"`
      if (!/\sloading\s*=/i.test(tag)) attributes += ' loading="lazy"'
      if (!/\sdecoding\s*=/i.test(tag)) attributes += ' decoding="async"'
      if (!/\ssrcset\s*=/i.test(tag)) {
        const candidates = widths.filter(w => w <= dimensions.width)
        if (!candidates.length) candidates.push(dimensions.width)
        attributes += ` srcset="${candidates.map(w => `/_next/image?url=${encodeURIComponent(src)}&amp;w=${w}&amp;q=75 ${w}w`).join(', ')}"`
        if (!/\ssizes\s*=/i.test(tag)) attributes += ` sizes="${sizes}"`
      }
      tag = tag.replace(/\s*\/?>$/, attributes + '>')
    } catch {
      // Missing uploads retain their original URL and don't break the page.
    }
    return [original, tag] as const
  }))
  for (const [original, replacement] of replacements) html = html.replace(original, replacement)
  return html
}

export async function prepareHomeImages<T extends { widgetType?: string; widgetKey: string; zone: string; colSpan: number; settings: string | null }>(widgets: T[]): Promise<T[]> {
  const sideCols = (widgets.some(w => w.zone === 'left') ? 3 : 0) + (widgets.some(w => w.zone === 'right' || w.zone === 'sidebar') ? 3 : 0)
  return Promise.all(widgets.map(async widget => {
    let settings: Record<string, unknown>
    try { settings = JSON.parse(widget.settings || '{}') } catch { return widget }
    const sidebar = ['left', 'right', 'sidebar'].includes(widget.zone)
    const columns = sidebar ? 3 : (12 - sideCols) * Math.min(Math.max(widget.colSpan || 12, 1), 12) / 12
    const sizes = `(min-width: 1152px) ${Math.round(1120 * columns / 12)}px, (min-width: 768px) ${Math.round(100 * columns / 12)}vw, 100vw`
    if (widget.widgetKey === 'image-banner') settings.sizes = sizes
    if (widget.widgetKey === 'video-embed' && ['left', 'top'].includes(widget.zone)) settings.priority = true
    if (widget.widgetKey === 'rich-text' && typeof settings.html === 'string') settings.html = await prepareHtml(settings.html, sizes)
    return { ...widget, settings: JSON.stringify(settings) }
  }))
}
