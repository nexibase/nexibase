# NexaBase

Next.js 15 기반 게시판 시스템

## 요구사항

- Node.js 18+
- MySQL 8.0+
- npm 또는 yarn

## 설치 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd nexabase
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 설정

`.env.example` 파일을 `.env.local`로 복사 후 수정:

```bash
cp .env.example .env.local
```

`.env.local` 파일 편집:

```env
# MySQL 연결 정보
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=nexabase

# Prisma용 (위 값들로 자동 조합)
DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}"

# SMTP 설정 (이메일 인증용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS="your-app-password"

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# JWT 시크릿 (보안키)
JWT_SECRET=your-secret-key
```

### 4. 데이터베이스 설정

MySQL에서 데이터베이스 생성:

```sql
CREATE DATABASE nexabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Prisma 스키마 적용:

```bash
npx prisma db push
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## 초기 설정

### 관리자 계정 생성

1. http://localhost:3000/signup 에서 첫 회원가입
2. **첫 번째 가입자는 자동으로 관리자**로 등록됩니다

### 기본 게시판 생성

1. 관리자로 로그인
2. http://localhost:3000/admin/boards 접속
3. "기본 게시판 생성" 버튼 클릭
   - 자유게시판 (free)
   - 공지사항 (notice)
   - 문의게시판 (qa)

## 주요 기능

- 회원가입/로그인 (이메일 인증)
- 게시판 CRUD
- 게시글 작성 (Tiptap 에디터)
- 이미지 업로드 (자동 리사이징, WebP 변환)
- 댓글/대댓글
- 리액션 (좋아요, 추천 등)
- 관리자 페이지

## 기술 스택

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Database**: MySQL + Prisma ORM
- **Editor**: Tiptap
- **Image Processing**: Sharp

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 인증 페이지 (로그인, 회원가입)
│   ├── admin/           # 관리자 페이지
│   ├── api/             # API 라우트
│   └── board/           # 게시판 페이지
├── components/          # 공통 컴포넌트
└── lib/                 # 유틸리티
```

## 라이선스

MIT
