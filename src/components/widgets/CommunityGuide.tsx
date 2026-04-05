"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

export default function CommunityGuide() {
  return (
    <Card className="h-full bg-gradient-to-br from-muted/50 to-muted/30">
      <CardContent className="p-4 h-full flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">커뮤니티 가이드</h3>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>- 서로 존중하는 대화</li>
          <li>- 욕설, 비방 금지</li>
          <li>- 광고/스팸 금지</li>
        </ul>
      </CardContent>
    </Card>
  )
}
