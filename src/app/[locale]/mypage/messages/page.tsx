"use client"

import { useTranslations } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { MessageSquare } from "lucide-react"
import { ConversationList } from "@/components/messaging/ConversationList"

export default function MessagesPage() {
  const t = useTranslations('mypage.messages')
  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t('label')}
        </h2>
        <ConversationList />
      </div>
    </MyPageLayout>
  )
}
