# NexiBase

> **Next.js-based foundation for intelligent, extensible web applications.**

**NexiBase**는 **Next.js + I + Base**의 합성어로, Next.js를 기반으로 한 차세대 웹 서비스의 기본 구조(Base)를 의미합니다.

여기서 **I**는 *Intelligence, Idea, Interface, Individual, Innovation, Initial*을 포괄하며, AI를 포함한 지능형 기능부터 사용자 중심 설계까지 **확장 가능한 핵심 레이어**를 상징합니다.

## 왜 NexiBase인가?

- **AI 종속 아님** - 트렌드 변화에도 안전한 네이밍
- **I의 확장성** - AI, UX, 개인화 모두 포함 가능
- **Base / Infra 지향** - 프레임워크, 스타터, 플랫폼 어디에도 어울림

---

## 주요 기능

- 회원가입/로그인 (이메일 인증)
- 게시판 CRUD
- 게시글 작성 (Tiptap 에디터)
- 이미지 업로드 (자동 리사이징, WebP 변환)
- 댓글/대댓글
- 리액션 (좋아요, 추천 등)
- 관리자 페이지

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | MySQL + Prisma ORM |
| Editor | Tiptap |
| Image | Sharp |

## 요구사항

- Node.js 18+
- MySQL 8.0+
- npm 또는 yarn

---

## 설치 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd nexibase
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 설정

`.env.example` 파일을 `.env`로 복사 후 수정:

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
# MySQL 연결 정보
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=nexibase

# Prisma용 DATABASE_URL (위 값을 조합)
DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}"

# SMTP 설정 (이메일 인증용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. 데이터베이스 설정

MySQL에서 데이터베이스 생성:

```sql
CREATE DATABASE nexibase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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

---

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

---

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

---

## 커스터마이징 (고급)

> **주의:** 이 방법은 **권장하지 않습니다.** 코어 코드를 직접 수정하면 향후 업데이트 시 충돌이 발생할 수 있으며, 버그 수정이나 새로운 기능을 적용받기 어려워집니다. 가능하면 기본 제공되는 기능을 활용하고, 정말 필요한 경우에만 사용하세요.

NexiBase는 사용자가 코어 코드를 직접 수정하지 않고도 커스터마이징할 수 있는 구조를 제공합니다.

### 동작 원리

#### 라우트 (페이지)

**라우트란?** URL 경로와 연결되는 페이지 파일입니다.

| URL | 라우트 파일 |
|-----|-----------|
| `/` | `app/page.tsx` |
| `/login` | `app/(auth)/login/page.tsx` |
| `/board/free` | `app/board/[boardId]/page.tsx` |
| `/admin/settings` | `app/admin/settings/page.tsx` |

- `app/` 폴더가 있으면 → **모든 라우트를 `app/`에서만 찾음**
- `app/` 폴더가 없으면 → `src/app/` 사용 (기본)
- ⚠️ **중요**: 라우트는 부분 복사가 불가능합니다. `app/` 폴더가 존재하면 `src/app/`의 라우트는 무시됩니다.

#### 컴포넌트/유틸리티 (`@/` import)

**컴포넌트란?** 페이지에서 불러와 사용하는 재사용 가능한 UI 조각입니다. (예: Header, Button, Card 등)

- `@/components`, `@/lib` 등의 import는 **부분 복사 가능**
- `app/components/Header.tsx`가 있으면 → 이것 사용
- 없으면 → `src/components/Header.tsx` 사용 (자동 폴백)

### 커스터마이징 방법

```bash
# 전체 복사 (권장)
mkdir -p app
cp -r src/app/* app/
cp -r src/components app/
cp -r src/lib app/
```

### 폴더 구조

```
nexibase/
├── src/                    # 코어 코드 (git 추적, 업데이트 시 변경됨)
│   ├── app/
│   ├── components/
│   └── lib/
├── app/                    # 사용자 커스텀 (git 무시, 업데이트 영향 없음)
│   ├── (auth)/            # 모든 라우트 필수 복사
│   ├── admin/
│   ├── board/
│   ├── ...                # src/app의 모든 폴더
│   ├── components/        # 커스텀 컴포넌트 (부분 복사 가능)
│   └── lib/               # 커스텀 유틸리티 (부분 복사 가능)
└── prisma/                 # 데이터베이스 스키마
```

### 부분 커스터마이징

**컴포넌트/유틸리티만 부분 복사 가능**합니다. 라우트는 전체 복사해야 합니다.

```bash
# ✅ 가능: 컴포넌트만 부분 커스터마이징 (라우트는 src/app 사용)
mkdir -p app/components/layout
cp src/components/layout/Header.tsx app/components/layout/

# ✅ 가능: 유틸리티만 부분 커스터마이징
mkdir -p app/lib
cp src/lib/utils.ts app/lib/

# ❌ 불가능: 라우트 부분 복사
# app/ 폴더가 있으면 src/app/의 라우트는 무시됨
# 예: app/policy만 복사하면 /login 접속 시 404 발생
```

**라우트를 커스터마이징하려면 반드시 전체 복사:**
```bash
mkdir -p app
cp -r src/app/* app/
# 이후 원하는 라우트만 수정
```

### 주의사항

1. **업데이트 충돌**: `git pull` 시 `src/` 폴더는 업데이트되지만, `app/` 폴더는 영향받지 않습니다. 새로운 기능이나 버그 수정을 적용하려면 수동으로 병합해야 합니다.

2. **의존성 문제**: 코어 코드가 업데이트되면서 새로운 컴포넌트나 함수가 추가될 수 있습니다. 커스텀 코드에서 이를 사용하려면 해당 파일도 복사해야 합니다.

3. **되돌리기**: 커스터마이징을 취소하고 기본 상태로 돌아가려면 `app/` 폴더를 삭제하면 됩니다.
   ```bash
   rm -rf app/
   ```

4. **권장 방식**: 가능하면 `src/` 코드를 직접 수정하지 말고, 환경설정(`/admin/settings`)이나 콘텐츠 관리(`/admin/contents`)를 통해 커스터마이징하세요.

---

## 라이선스

MIT
