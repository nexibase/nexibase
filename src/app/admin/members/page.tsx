"use client"

import { useState } from "react"
import { Sidebar } from "@/components/admin/Sidebar"

export default function MembersPage() {
  const [activeMenu, setActiveMenu] = useState("members")

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-6">회원관리</h1>
            <p className="text-gray-600">회원 관리 기능이 여기에 구현됩니다.</p>  
          </div>
        </main>
      </div>
    </div>
  )
}