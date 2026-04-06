import { prisma } from '@/lib/prisma'

export default async function ThemeLoader() {
  let themeFolder = 'default'

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'theme_folder' }
    })
    if (setting?.value && setting.value !== 'default') {
      themeFolder = setting.value
    }
  } catch {
    // fallback to default
  }

  if (themeFolder === 'default') return null

  return (
    <link
      rel="stylesheet"
      href={`/themes/${themeFolder}.css`}
      data-theme={themeFolder}
    />
  )
}
