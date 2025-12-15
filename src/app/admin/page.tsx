"use client"

import { Sidebar } from "@/components/admin/Sidebar"
import { DashboardContent } from "@/components/admin/DashboardContent"

export default function AdminDashboard() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <DashboardContent />
      </main>
    </div>
  )
}
