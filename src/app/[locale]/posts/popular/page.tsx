import { Suspense } from "react"
import { PopularPage } from "@/components/pages"
import { Loader2 } from "lucide-react"

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PopularPage />
    </Suspense>
  )
}
