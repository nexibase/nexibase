"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink, Monitor, UserCircle, Lock } from "lucide-react"

export default function DemoGuide() {
  return (
    <Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
      <CardContent className="p-5 h-full flex flex-col justify-center">
        <div className="flex items-center gap-2.5 mb-4">
          <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-base">Try the demo site</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Experience every NexiBase feature yourself.
        </p>

        <div className="bg-white/60 dark:bg-white/5 rounded-md p-3 mb-4 space-y-2">
          <div className="flex items-center gap-2.5 text-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">ID:</span>
            <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">demo@nexibase.com</code>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">PW:</span>
            <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">demo1234</code>
          </div>
        </div>

        <a
          href="https://demo.nexibase.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md px-4 py-2 transition-colors"
        >
          Visit the demo site
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}
