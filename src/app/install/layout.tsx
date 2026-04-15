export const metadata = {
  title: 'Nexibase — Install',
}

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  )
}
