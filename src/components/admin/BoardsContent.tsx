import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Edit, Trash2, Plus, MessageSquare } from "lucide-react"

export function BoardsContent() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">게시판관리</h2>
          <p className="text-muted-foreground">게시판과 게시글을 관리합니다.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          새 게시판 생성
        </Button>
      </div>

      {/* 검색 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="게시판 또는 게시글 검색..." className="pl-10" />
            </div>
            <Button variant="outline">필터</Button>
          </div>
        </CardContent>
      </Card>

      {/* 게시판 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  게시판 {i}
                </CardTitle>
                <Badge variant="outline">공개</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                게시판 {i}에 대한 설명입니다.
              </p>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>게시글: {i * 10}</span>
                <span>회원: {i * 5}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="mr-1 h-3 w-3" />
                  수정
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Trash2 className="mr-1 h-3 w-3" />
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
