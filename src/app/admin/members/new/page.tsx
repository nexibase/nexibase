"use client"

import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { MemberForm } from "@/components/admin/MemberForm"

export default function NewMemberPage() {
  const router = useRouter()

  const handleCancel = () => {
    router.push('/admin/members')
  }

  const handleSuccess = () => {
    router.push('/admin/members?success=true')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <Sidebar activeMenu="members" onMenuChange={() => {}} />
        <main className="flex-1 lg:ml-0 p-6">
          <div className="max-w-7xl mx-auto">
            <MemberForm 
              mode="create"
              onCancel={handleCancel}
              onSuccess={handleSuccess}
            />
          </div>
        </main>
      </div>
    </div>
  )
} 