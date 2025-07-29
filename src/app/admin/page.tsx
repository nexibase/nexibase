"use client"

import { useState } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { DashboardContent } from "@/components/admin/DashboardContent"
import { UsersContent } from "@/components/admin/UsersContent"
import { BoardsContent } from "@/components/admin/BoardsContent"
import { SettingsContent } from "@/components/admin/SettingsContent"

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard")

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <DashboardContent />
      case "users":
        return <UsersContent />
      case "boards":
        return <BoardsContent />
      case "settings":
        return <SettingsContent />
      default:
        return <DashboardContent />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
