"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Check } from "lucide-react"
import { useState } from "react"

const steps = [
  {
    step: 1,
    title: "저장소 클론",
    command: "git clone https://github.com/gnuboard/nexibase.git",
  },
  {
    step: 2,
    title: "의존성 설치",
    command: "cd nexibase && npm install",
  },
  {
    step: 3,
    title: "환경 설정",
    command: "cp .env.example .env.local",
  },
  {
    step: 4,
    title: "데이터베이스 마이그레이션",
    command: "npx prisma db push",
  },
  {
    step: 5,
    title: "개발 서버 실행",
    command: "npm run dev",
  },
]

function CodeBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-lg text-sm overflow-x-auto">
        <code>{command}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function GettingStarted() {
  return (
    <section id="getting-started" className="py-24 bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            몇 분 만에 시작하기
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            간단한 단계를 따라 NexiBase 프로젝트를 설정하고 애플리케이션 개발을 시작하세요.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((item) => (
            <Card key={item.step} className="border-border/50 bg-background/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold">{item.title}</h3>
                    <CodeBlock command={item.command} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            도움이 필요하신가요? 문서를 확인하거나 GitHub에 이슈를 등록해주세요.
          </p>
          <Button variant="outline" asChild>
            <a
              href="https://github.com/gnuboard/nexibase"
              target="_blank"
              rel="noopener noreferrer"
            >
              문서 보기
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
