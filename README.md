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
- **전문 검색** (MySQL FULLTEXT 검색)
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

#### 신규 설치 (처음 설치하는 경우)

```bash
# 마이그레이션 적용 및 Prisma Client 생성
npm run db:setup
```

#### 기존 사용자 (업데이트 시)

```bash
# 새로운 마이그레이션 적용
npm run db:migrate
```

> **참고:** `db push` 대신 `migrate`를 사용하면 스키마 변경 히스토리가 관리되어 안전한 업데이트가 가능합니다.

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

## 테마 커스터마이징

NexiBase는 테마 기반 커스터마이징을 지원합니다. 라우트(URL)는 그대로 유지하면서 **UI 컴포넌트만 교체**할 수 있습니다.

### 테마 구조

```
src/themes/
├── default/           # 기본 테마 (git 추적)
│   └── HomePage.tsx
└── custom/            # 커스텀 테마 (git 무시, 사용자 수정용)
    └── HomePage.tsx
```

### 커스터마이징 방법

```bash
# 1. custom 테마 폴더 생성
mkdir -p src/themes/custom

# 2. 수정할 컴포넌트만 복사
cp src/themes/default/HomePage.tsx src/themes/custom/

# 3. src/themes/custom/HomePage.tsx 수정
```

### 동작 원리

- 각 페이지(`page.tsx`)는 테마 컴포넌트를 불러와 렌더링합니다
- `src/themes/custom/` 폴더는 git에서 무시되어 업데이트 영향 없음
- 라우트 전체 복사 없이 **원하는 페이지만 커스터마이징** 가능

### 사용 가능한 테마 컴포넌트

| 컴포넌트 | 설명 | 사용처 |
|---------|------|--------|
| `Header` | 헤더 (네비게이션, 로그인 등) | 모든 페이지 |
| `Footer` | 푸터 (링크, 저작권 등) | 모든 페이지 |
| `HomePage` | 메인 페이지 콘텐츠 | `/` |

> 향후 더 많은 테마 컴포넌트가 추가될 예정입니다.

### 주의사항

1. **부분 복사 가능**: 수정할 컴포넌트만 `custom/` 폴더에 복사하면 됩니다. 나머지는 `default/`를 사용합니다.

2. **되돌리기**: 커스터마이징을 취소하려면 해당 파일을 삭제하면 됩니다.
   ```bash
   rm src/themes/custom/HomePage.tsx
   ```

3. **업데이트**: `git pull` 시 `src/themes/default/`는 업데이트되지만, `custom/`은 영향받지 않습니다.

---

## 전체 커스터마이징 (고급)

> **주의:** 이 방법은 **권장하지 않습니다.** 라우트 전체를 복사하면 향후 업데이트 시 충돌이 발생할 수 있습니다. 가능하면 위의 **테마 커스터마이징**을 사용하세요.

### 동작 원리

**라우트란?** `page.tsx` 파일이 있는 폴더입니다. 폴더 경로가 URL이 됩니다.

| URL | 라우트 파일 |
|-----|-----------|
| `/` | `app/page.tsx` |
| `/login` | `app/(auth)/login/page.tsx` |
| `/board/free` | `app/board/[boardId]/page.tsx` |

> ⚠️ **핵심**: `app/` 폴더가 존재하면 Next.js는 **모든 라우트를 `app/`에서만 찾습니다.**

### 커스터마이징 방법

```bash
# 전체 복사 (라우트 + 컴포넌트 + 유틸리티)
mkdir -p app
cp -r src/app/* app/
cp -r src/components app/
cp -r src/lib app/
```

### 주의사항

1. **라우트 전체 복사 필수**: `app/` 폴더가 존재하면 모든 라우트를 복사해야 합니다.
2. **업데이트 충돌**: `git pull` 시 수동 병합이 필요합니다.
3. **되돌리기**: `rm -rf app/`으로 기본 상태로 복원

---

## 검색 기능

NexiBase는 MySQL FULLTEXT 인덱스를 활용한 고성능 검색을 지원합니다.

### 검색 특징

- **Boolean 모드 검색**: 정확한 단어 매칭
- **정렬 옵션**: 정확도순, 최신순, 인기순
- **게시판 필터**: 특정 게시판 내에서만 검색
- **자동 폴백**: FULLTEXT 인덱스가 없는 환경에서는 자동으로 LIKE 검색 사용

### 검색 URL

```
/search?q=검색어&board=free&sort=relevance
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `q` | 검색어 (2자 이상) | 필수 |
| `board` | 게시판 slug (all=전체) | all |
| `sort` | 정렬 (relevance, latest, popular) | relevance |
| `page` | 페이지 번호 | 1 |

---

## 라이선스

MIT
