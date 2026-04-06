import { pluginManifest } from '@/plugins/_generated'
import type { PluginMeta } from '@/plugins/_generated'
import { prisma } from '@/lib/prisma'

export async function isPluginEnabled(folderName: string): Promise<boolean> {
  const plugin = pluginManifest[folderName]
  if (!plugin) return false

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folderName}_enabled` }
    })

    if (setting) {
      return setting.value === 'true'
    }

    return plugin.defaultEnabled
  } catch {
    return plugin.defaultEnabled
  }
}

export async function getPluginSlug(folderName: string): Promise<string> {
  const plugin = pluginManifest[folderName]
  if (!plugin) return folderName

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folderName}_slug` }
    })

    if (setting && setting.value) {
      return setting.value
    }

    return plugin.slug
  } catch {
    return plugin.slug
  }
}

export async function getAllPlugins(): Promise<(PluginMeta & { folder: string, enabled: boolean, currentSlug: string })[]> {
  const results = []

  for (const [folder, meta] of Object.entries(pluginManifest)) {
    const enabled = await isPluginEnabled(folder)
    const currentSlug = await getPluginSlug(folder)
    results.push({ ...meta, folder, enabled, currentSlug })
  }

  return results
}

export function getPluginFolderBySlug(slug: string): string | null {
  for (const [folder, meta] of Object.entries(pluginManifest)) {
    if (meta.slug === slug) return folder
  }
  return null
}

export async function getDisabledSlugs(): Promise<string[]> {
  const slugs: string[] = []

  for (const [folder, meta] of Object.entries(pluginManifest)) {
    const enabled = await isPluginEnabled(folder)
    if (!enabled) {
      const slug = await getPluginSlug(folder)
      slugs.push(slug)
    }
  }

  return slugs
}
