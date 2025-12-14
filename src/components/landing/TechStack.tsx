"use client"

const technologies = [
  {
    category: "프론트엔드",
    items: [
      { name: "Next.js 15", description: "App Router 기반 React 프레임워크" },
      { name: "React 19", description: "서버 컴포넌트를 포함한 최신 React" },
      { name: "Tailwind CSS 4", description: "유틸리티 우선 CSS 프레임워크" },
      { name: "shadcn/ui", description: "아름답고 접근성 있는 컴포넌트" },
    ],
  },
  {
    category: "백엔드",
    items: [
      { name: "API Routes", description: "Next.js 내장 API 핸들러" },
      { name: "Prisma ORM", description: "타입 안전한 데이터베이스 툴킷" },
      { name: "MySQL 8.0+", description: "안정적인 관계형 데이터베이스" },
      { name: "Sharp", description: "고성능 이미지 처리 라이브러리" },
    ],
  },
  {
    category: "주요 기능",
    items: [
      { name: "Tiptap 에디터", description: "헤드리스 리치 텍스트 에디터" },
      { name: "next-themes", description: "테마 전환 및 다크 모드 지원" },
      { name: "Nodemailer", description: "이메일 인증용 메일 전송" },
      { name: "bcrypt", description: "안전한 비밀번호 해싱" },
    ],
  },
]

export function TechStack() {
  return (
    <section id="tech-stack" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            모던 기술 스택
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            확장성, 유지보수성, 개발자 경험을 보장하는 최신의 신뢰할 수 있는 기술들로 구축되었습니다.
          </p>
        </div>

        {/* Tech Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {technologies.map((category, index) => (
            <div key={index} className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                {category.category}
              </h3>
              <ul className="space-y-4">
                {category.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
