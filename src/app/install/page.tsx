import Link from 'next/link'
import { localeRegistry } from '@/lib/install/_generated-registry'
import pkg from '../../../package.json'

export default function InstallStep1() {
  const entries = Object.entries(localeRegistry)

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Nexibase</h1>
        <p className="text-sm text-slate-500">v{pkg.version}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-center">
          Select Your Language / 언어를 선택하세요
        </h2>
        <div className="flex flex-col gap-2">
          {entries.map(([locale, entry]) => (
            <Link
              key={locale}
              href={`/install/setup?locale=${locale}`}
              className="block w-full text-center py-3 px-4 rounded-md border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              {entry.displayName}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Welcome to the Nexibase installation wizard.
      </div>
    </div>
  )
}
