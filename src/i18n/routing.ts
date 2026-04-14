import { defineRouting } from 'next-intl/routing'
import { SUPPORTED_LOCALES } from './_generated-locales'

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'en',
  localePrefix: 'never',
})

export type Locale = (typeof routing.locales)[number]
