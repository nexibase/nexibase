import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, Users, MessageCircle, TrendingUp, Star, Heart, Share2 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const trendingTopics = [
    { name: "웹 개발", count: 1.2 },
    { name: "React", count: 850 },
    { name: "AI/ML", count: 720 },
    { name: "취업", count: 680 },
    { name: "스타트업", count: 520 }
  ];

  const popularPosts = [
    {
      id: 1,
      title: "Next.js 15 새로운 기능들 정리",
      author: "개발자김",
      avatar: "/api/placeholder/40/40",
      likes: 124,
      comments: 23,
      tags: ["Next.js", "React", "웹개발"],
      timeAgo: "2시간 전"
    },
    {
      id: 2,
      title: "신입 개발자 면접 후기 및 팁 공유",
      author: "코딩초보",
      avatar: "/api/placeholder/40/40",
      likes: 89,
      comments: 45,
      tags: ["취업", "면접", "신입"],
      timeAgo: "4시간 전"
    },
    {
      id: 3,
      title: "shadcn/ui로 빠르게 UI 구성하기",
      author: "UI마스터",
      avatar: "/api/placeholder/40/40",
      likes: 156,
      comments: 31,
      tags: ["UI", "shadcn", "React"],
      timeAgo: "6시간 전"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary">DevCommunity</h1>
              <nav className="hidden md:flex items-center space-x-6">
                <Button variant="ghost">홈</Button>
                <Button variant="ghost">질문/답변</Button>
                <Button variant="ghost">프로젝트</Button>
                <Button variant="ghost">스터디</Button>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="검색..." 
                  className="pl-10 w-64"
                />
              </div>
              <Link href="/login">
                <Button>로그인</Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline">회원가입</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                개발자들의 소통 공간에 오신 것을 환영합니다!
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                질문하고, 답변하고, 함께 성장하는 개발자 커뮤니티
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  질문하기
                </Button>
                <Button size="lg" variant="outline">
                  답변하러 가기
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">12.5K</div>
                  <div className="text-sm text-muted-foreground">활성 사용자</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <MessageCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">8.3K</div>
                  <div className="text-sm text-muted-foreground">질문</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">15.2K</div>
                  <div className="text-sm text-muted-foreground">답변</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">95%</div>
                  <div className="text-sm text-muted-foreground">해결률</div>
                </CardContent>
              </Card>
            </div>

            {/* Popular Posts */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">인기 게시글</h3>
                <Button variant="outline" size="sm">더보기</Button>
              </div>

              {popularPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <Avatar>
                        <AvatarImage src={post.avatar} />
                        <AvatarFallback>{post.author[0]}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium">{post.author}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{post.timeAgo}</span>
                        </div>
                        
                        <h4 className="text-lg font-semibold mb-3 hover:text-blue-600 cursor-pointer">
                          {post.title}
                        </h4>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {post.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Heart className="h-4 w-4" />
                            <span>{post.likes}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="h-4 w-4" />
                            <span>{post.comments}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="space-y-6">
              {/* Trending Topics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    인기 토픽
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trendingTopics.map((topic, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm hover:text-blue-600 cursor-pointer">
                          #{topic.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {topic.count < 1000 ? topic.count : `${topic.count}k`}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>빠른 액션</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    질문하기
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    스터디 찾기
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Star className="h-4 w-4 mr-2" />
                    프로젝트 공유
                  </Button>
                </CardContent>
              </Card>

              {/* Community Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle>커뮤니티 가이드</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>• 서로 존중하며 소통해주세요</p>
                    <p>• 구체적이고 명확한 질문을 해주세요</p>
                    <p>• 답변에는 감사 인사를 잊지 마세요</p>
                    <p>• 도움이 되는 답변에 좋아요를 눌러주세요</p>
                  </div>
                  <Separator className="my-4" />
                  <Button variant="link" className="p-0 h-auto text-sm">
                    자세한 가이드라인 보기 →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
