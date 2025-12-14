"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  Shield,
  Zap,
  Database,
  Palette,
  MessageSquare,
  Image,
  Lock,
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "회원 인증",
    description:
      "이메일 인증, 보안 로그인, 세션 관리를 포함한 완전한 인증 시스템을 제공합니다.",
  },
  {
    icon: MessageSquare,
    title: "게시판 시스템",
    description:
      "CRUD 기능, 댓글, 대댓글, 리액션을 지원하는 완벽한 게시판 시스템입니다.",
  },
  {
    icon: Palette,
    title: "리치 텍스트 에디터",
    description:
      "서식, 링크, 이미지, 코드 블록을 지원하는 Tiptap 기반 에디터입니다.",
  },
  {
    icon: Image,
    title: "이미지 처리",
    description:
      "Sharp를 활용한 자동 이미지 최적화 - 리사이징, WebP 변환, 압축을 지원합니다.",
  },
  {
    icon: Database,
    title: "Prisma ORM",
    description:
      "타입 안전한 데이터베이스 접근, 간편한 마이그레이션, 강력한 쿼리 기능을 제공합니다.",
  },
  {
    icon: Shield,
    title: "관리자 대시보드",
    description:
      "회원 관리, 게시판 설정, 사이트 설정을 위한 종합 관리자 패널입니다.",
  },
  {
    icon: Lock,
    title: "보안 우선",
    description:
      "일반적인 보안 취약점에 대한 보호와 안전한 인증 패턴이 기본 내장되어 있습니다.",
  },
  {
    icon: Zap,
    title: "최적화된 성능",
    description:
      "React 서버 컴포넌트, 효율적인 캐싱, 지연 로딩으로 속도를 최적화했습니다.",
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            필요한 모든 기능
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            모던 웹 애플리케이션 구축을 위한 모든 필수 기능이 기본으로 포함된 완벽한 기반입니다.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
