const fs = require('fs')
const path = require('path')

const PLUGINS_DIR = path.join(__dirname, '..', 'src', 'plugins')
const OUTPUT_FILE = path.join(PLUGINS_DIR, '_generated.ts')
const APP_DIR = path.join(__dirname, '..', 'src', 'app')
const SCHEMA_BASE = path.join(__dirname, '..', 'prisma', 'schema.base.prisma')
const SCHEMA_OUTPUT = path.join(__dirname, '..', 'prisma', 'schema.prisma')

function scanPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
  const folders = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name)

  const plugins = []
  const slugs = new Map()

  for (const folder of folders) {
    const pluginFile = path.join(PLUGINS_DIR, folder, 'plugin.ts')
    if (!fs.existsSync(pluginFile)) {
      console.warn(`[scan-plugins] Warning: ${folder}/ has no plugin.ts, skipping`)
      continue
    }

    const content = fs.readFileSync(pluginFile, 'utf-8')
    const getName = (key) => {
      const match = content.match(new RegExp(`${key}:\\s*['"\`]([^'"\`]+)['"\`]`))
      return match ? match[1] : ''
    }
    const getBool = (key) => {
      const match = content.match(new RegExp(`${key}:\\s*(true|false)`))
      return match ? match[1] === 'true' : false
    }

    const name = getName('name') || folder
    const slug = getName('slug') || folder
    const version = getName('version') || '0.0.0'
    const author = getName('author') || ''
    const authorDomain = getName('authorDomain') || ''
    const repository = getName('repository') || ''
    const description = getName('description') || ''
    const defaultEnabled = getBool('defaultEnabled')

    if (slugs.has(slug)) {
      console.error(`ERROR: slug '${slug}' conflict!`)
      console.error(`  - src/plugins/${slugs.get(slug)}/plugin.ts`)
      console.error(`  - src/plugins/${folder}/plugin.ts`)
      console.error(`Change one of the slugs to resolve.`)
      process.exit(1)
    }
    slugs.set(slug, folder)

    const hasRoutes = fs.existsSync(path.join(PLUGINS_DIR, folder, 'routes'))
    const hasApi = fs.existsSync(path.join(PLUGINS_DIR, folder, 'api'))
    const hasAdmin = fs.existsSync(path.join(PLUGINS_DIR, folder, 'admin'))
    const hasWidgets = fs.existsSync(path.join(PLUGINS_DIR, folder, 'widgets'))
    const hasMenus = fs.existsSync(path.join(PLUGINS_DIR, folder, 'menus'))
    const hasSchema = fs.existsSync(path.join(PLUGINS_DIR, folder, 'schema.prisma'))

    // Parse header menus
    let headerMenus = []
    if (hasMenus) {
      const headerMenuFile = path.join(PLUGINS_DIR, folder, 'menus', 'header.ts')
      if (fs.existsSync(headerMenuFile)) {
        const menuContent = fs.readFileSync(headerMenuFile, 'utf-8')
        const menuMatches = menuContent.matchAll(/\{\s*label:\s*['"]([^'"]+)['"]\s*,\s*icon:\s*['"]([^'"]*)['"]\s*,\s*sortOrder:\s*(\d+)/g)
        for (const m of menuMatches) {
          headerMenus.push({ label: m[1], icon: m[2], sortOrder: parseInt(m[3]) })
        }
      }
    }

    // Parse widget metas
    let widgetMetas = []
    if (hasWidgets) {
      const widgetsDir = path.join(PLUGINS_DIR, folder, 'widgets')
      const widgetFiles = fs.readdirSync(widgetsDir).filter(f => f.endsWith('.meta.ts'))
      for (const wf of widgetFiles) {
        const widgetBaseName = wf.replace('.meta.ts', '')
        const kebabKey = `${folder}-${widgetBaseName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`
        const wContent = fs.readFileSync(path.join(widgetsDir, wf), 'utf-8')
        const wTitle = (wContent.match(/title:\s*['"]([^'"]+)['"]/) || [])[1] || widgetBaseName
        const wZone = (wContent.match(/defaultZone:\s*['"]([^'"]+)['"]/) || [])[1] || 'main'
        const wColSpan = parseInt((wContent.match(/defaultColSpan:\s*(\d+)/) || [])[1] || '1')
        const wRowSpan = parseInt((wContent.match(/defaultRowSpan:\s*(\d+)/) || [])[1] || '1')
        const settingsMatch = wContent.match(/settingsSchema:\s*(\{[^}]+\}|null)/)
        let wSettings = null
        if (settingsMatch && settingsMatch[1] !== 'null') {
          try {
            wSettings = JSON.parse(settingsMatch[1].replace(/(\w+):/g, '"$1":'))
          } catch { wSettings = null }
        }
        widgetMetas.push({ widgetKey: kebabKey, title: wTitle, defaultZone: wZone, defaultColSpan: wColSpan, defaultRowSpan: wRowSpan, settingsSchema: wSettings })
      }
    }

    // Parse admin menus
    let adminMenus = []
    if (hasAdmin) {
      const adminMenuFile = path.join(PLUGINS_DIR, folder, 'admin', 'menus.ts')
      if (fs.existsSync(adminMenuFile)) {
        const amContent = fs.readFileSync(adminMenuFile, 'utf-8')
        // Simple parse: use Function() to safely evaluate the JS array literal
        try {
          const arrayStr = amContent
            .replace(/export\s+default\s+/, '')
            .trim()
          adminMenus = (new Function('return ' + arrayStr))()
        } catch (e) {
          console.warn(`[scan-plugins] Warning: could not parse admin menus for ${folder}:`, e.message)
        }
      }
    }

    plugins.push({
      folder, name, slug, version, author, authorDomain, repository,
      description, defaultEnabled, hasRoutes, hasApi, hasAdmin,
      hasWidgets, hasMenus, hasSchema,
      headerMenus, widgetMetas, adminMenus,
    })
  }

  console.log(`[scan-plugins] Found ${plugins.length} plugin(s): ${plugins.map(p => p.folder).join(', ')}`)

  generateManifest(plugins)
  generateAppWrappers(plugins)
  mergeSchemas(plugins)
}

function generateManifest(plugins) {
  const entries = plugins.map(p => {
    return `  '${p.folder}': {
    name: '${p.name}',
    slug: '${p.slug}',
    version: '${p.version}',
    author: '${p.author}',
    authorDomain: '${p.authorDomain}',
    repository: '${p.repository}',
    description: '${p.description}',
    defaultEnabled: ${p.defaultEnabled},
    hasRoutes: ${p.hasRoutes},
    hasApi: ${p.hasApi},
    hasAdmin: ${p.hasAdmin},
    hasWidgets: ${p.hasWidgets},
    hasMenus: ${p.hasMenus},
    hasSchema: ${p.hasSchema},
    headerMenus: ${JSON.stringify(p.headerMenus)},
    widgetMetas: ${JSON.stringify(p.widgetMetas)},
    adminMenus: ${JSON.stringify(p.adminMenus)},
  }`
  })

  const output = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually

export interface PluginHeaderMenu {
  label: string
  icon: string
  sortOrder: number
}

export interface PluginWidgetMeta {
  widgetKey: string
  title: string
  defaultZone: string
  defaultColSpan: number
  defaultRowSpan: number
  settingsSchema: Record<string, unknown> | null
}

export interface PluginAdminMenuItem {
  label: string
  icon: string
  path?: string
  isGroup?: boolean
  children?: PluginAdminMenuItem[]
}

export interface PluginMeta {
  name: string
  slug: string
  version: string
  author: string
  authorDomain: string
  repository: string
  description: string
  defaultEnabled: boolean
  hasRoutes: boolean
  hasApi: boolean
  hasAdmin: boolean
  hasWidgets: boolean
  hasMenus: boolean
  hasSchema: boolean
  headerMenus: PluginHeaderMenu[]
  widgetMetas: PluginWidgetMeta[]
  adminMenus: PluginAdminMenuItem[]
}

export const pluginManifest: Record<string, PluginMeta> = {
${entries.join(',\n')}
}

export type PluginFolder = keyof typeof pluginManifest
`

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')
  console.log(`[scan-plugins] Generated ${OUTPUT_FILE}`)
}

function generateAppWrappers(plugins) {
  for (const p of plugins) {
    const slug = p.slug

    // Generate route wrappers
    if (p.hasRoutes) {
      const routesDir = path.join(PLUGINS_DIR, p.folder, 'routes')
      generateWrappersRecursive(routesDir, path.join(APP_DIR, slug), `@/plugins/${p.folder}/routes`, p.folder)
    }

    // Generate API wrappers
    if (p.hasApi) {
      const apiDir = path.join(PLUGINS_DIR, p.folder, 'api')
      generateWrappersRecursive(apiDir, path.join(APP_DIR, 'api', slug), `@/plugins/${p.folder}/api`, p.folder)
    }

    // Generate admin page wrappers
    if (p.hasAdmin) {
      const adminDir = path.join(PLUGINS_DIR, p.folder, 'admin')
      // Only generate for page.tsx files, not api/ subfolder
      const adminPagePath = path.join(adminDir, 'page.tsx')
      if (fs.existsSync(adminPagePath)) {
        generateWrappersRecursive(adminDir, path.join(APP_DIR, 'admin', slug), `@/plugins/${p.folder}/admin`, p.folder, ['api'])
      }

      // Generate admin API wrappers
      const adminApiDir = path.join(adminDir, 'api')
      if (fs.existsSync(adminApiDir)) {
        generateWrappersRecursive(adminApiDir, path.join(APP_DIR, 'api', 'admin', slug), `@/plugins/${p.folder}/admin/api`, p.folder)
      }
    }
  }

  console.log('[scan-plugins] Generated app wrappers for plugin routes')
}

function generateWrappersRecursive(sourceDir, targetDir, importBase, pluginFolder, skipDirs = []) {
  if (!fs.existsSync(sourceDir)) return

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      generateWrappersRecursive(sourcePath, targetPath, `${importBase}/${entry.name}`, pluginFolder, skipDirs)
    } else if (entry.name === 'page.tsx') {
      // Generate page wrapper
      fs.mkdirSync(targetDir, { recursive: true })
      const importPath = `${importBase}/page`
      const content = `// AUTO-GENERATED by scan-plugins.js (plugin: ${pluginFolder}) — do not edit\nexport { default } from '${importPath}'\n`
      fs.writeFileSync(targetPath, content, 'utf-8')
    } else if (entry.name === 'route.ts') {
      // Generate API route wrapper - detect and re-export only existing HTTP methods
      fs.mkdirSync(targetDir, { recursive: true })
      const importPath = `${importBase}/route`
      const sourceContent = fs.readFileSync(sourcePath, 'utf-8')
      const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      const exported = httpMethods.filter(m => new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(sourceContent))
      if (exported.length > 0) {
        const content = `// AUTO-GENERATED by scan-plugins.js (plugin: ${pluginFolder}) — do not edit\nexport { ${exported.join(', ')} } from '${importPath}'\n`
        fs.writeFileSync(targetPath, content, 'utf-8')
      }
    } else if (entry.name === 'layout.tsx') {
      fs.mkdirSync(targetDir, { recursive: true })
      const importPath = `${importBase}/layout`
      const content = `// AUTO-GENERATED by scan-plugins.js (plugin: ${pluginFolder}) — do not edit\nexport { default } from '${importPath}'\n`
      fs.writeFileSync(targetPath, content, 'utf-8')
    }
  }
}

function mergeSchemas(plugins) {
  let baseSchema = ''
  if (fs.existsSync(SCHEMA_BASE)) {
    baseSchema = fs.readFileSync(SCHEMA_BASE, 'utf-8')
  } else {
    const currentSchema = path.join(__dirname, '..', 'prisma', 'schema.prisma')
    if (fs.existsSync(currentSchema)) {
      baseSchema = fs.readFileSync(currentSchema, 'utf-8')
      fs.writeFileSync(SCHEMA_BASE, baseSchema, 'utf-8')
      console.log(`[scan-plugins] Created ${SCHEMA_BASE} from existing schema.prisma`)
    }
  }

  const pluginSchemas = []
  for (const p of plugins) {
    if (p.hasSchema) {
      const schemaPath = path.join(PLUGINS_DIR, p.folder, 'schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      pluginSchemas.push(`\n// ======= Plugin: ${p.folder} =======\n${content}`)
    }
  }

  const merged = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually
// Edit prisma/schema.base.prisma for core models
// Edit src/plugins/*/schema.prisma for plugin models

${baseSchema}
${pluginSchemas.join('\n')}
`

  fs.writeFileSync(SCHEMA_OUTPUT, merged, 'utf-8')
  console.log(`[scan-plugins] Merged ${pluginSchemas.length} plugin schema(s) into ${SCHEMA_OUTPUT}`)
}

scanPlugins()
