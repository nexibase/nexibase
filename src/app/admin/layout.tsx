"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/me')
        const data = await response.json()

        if (!response.ok || !data.user) {
          router.push('/login')
          return
        }

        if (data.user.role !== 'admin') {
          alert('관리자만 접근할 수 있습니다.')
          router.push('/')
          return
        }

        setIsAuthorized(true)
      } catch (error) {
        console.error('권한 확인 실패:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAdmin()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 lg:ml-0 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
