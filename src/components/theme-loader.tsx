import { prisma } from '@/lib/prisma'
import { unstable_noStore as noStore } from 'next/cache'

export default async function ThemeLoader() {
  noStore() // Disable static caching — always read the current DB value

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
