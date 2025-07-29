"use client"

import { useRouter, useParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { MemberForm } from "@/components/admin/MemberForm"

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string

  const handleCancel = () => {
    router.push('/admin/members')
  }

  const handleSuccess = () => {
    router.push('/admin/members?updated=true')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <Sidebar activeMenu="members" onMenuChange={() => {}} />
        <main className="flex-1 lg:ml-0 p-6">
          <div className="max-w-7xl mx-auto">
            <MemberForm 
              mode="edit"
              memberId={memberId}
              onCancel={handleCancel}
              onSuccess={handleSuccess}
            />
          </div>
        </main>
      </div>
    </div>
  )
} 