"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, LayoutGrid, FileText, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"

interface Board {
  id: number
  slug: string
  name: string
  description: string | null
  postCount: number
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const res = await fetch('/api/boards?limit=100')
        if (res.ok) {
          const data = await res.json()
          setBoards(data.boards || [])
        }
      } catch (error) {
        console.error('게시판 목록 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBoards()
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <LayoutGrid className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">전체 게시판</h1>
            </div>
            <p className="text-muted-foreground">
              다양한 주제의 게시판을 둘러보세요
            </p>
          </div>

          {/* 게시판 목록 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : boards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boards.map((board) => (
                <Link key={board.id} href={`/board/${board.slug}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
                              {board.name}
                            </h3>
                          </div>
                          {board.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {board.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {board.postCount}개
                        </Badge>
                      </div>
                      <div className="flex items-center text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>게시판 가기</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                아직 게시판이 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
