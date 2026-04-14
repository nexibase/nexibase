export const metadata = {
  title: 'Nexibase — Setup Required',
}

export default function SetupRequiredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  )
}
