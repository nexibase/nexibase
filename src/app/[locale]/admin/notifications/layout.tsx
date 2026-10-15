'use client'

import type { ReactNode } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'

export default function NotificationsAdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen bg-background"><Sidebar /><main className="min-w-0 flex-1">{children}</main></div>
}
