import { Suspense } from "react"
import { LoginPage } from "@/components/pages"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LoginPage />
    </Suspense>
  )
}
