# NexiBase

> **Next.js 기반의 플러그인 기반 커뮤니티 플랫폼**

**NexiBase**는 **Next.js + I + Base**의 합성어로, Next.js를 기반으로 한 차세대 웹 서비스의 기본 구조(Base)를 의미합니다.

한국어로는 **넥시베이스**라고 표기합니다.

---

## 주요 기능

### 플러그인 시스템
- 폴더 기반 플러그인 구조 (`src/plugins/`)
- 플러그인 활성화/비활성화 (관리자 토글)
- 플러그인별 라우트, API, 위젯, 메뉴 자동 등록
- 비활성 플러그인 라우트 차단
- slug 커스터마이징 (URL 경로 변경)
- 플러그인별 Prisma 스키마 분리

### 위젯 시스템
- 홈페이지 위젯 배치 관리 (상단/중앙/하단)
- 레이아웃 사이드바 (좌측/우측, 모든 페이지 적용)
- 12컬럼 그리드 기반 반응형
- 플러그인 위젯 자동 등록
- 독립 위젯 지원 (`src/widgets/`)

### 레이아웃 시스템
- 기본/커스텀 레이아웃 전환
- Header, HomePage, Footer 부분 오버라이드
- 폴더 기반 자동 인식

### 테마 시스템
- CSS 변수 기반 테마 전환
- 서버사이드 로드 (깜빡임 없음)
- 관리자 설정에서 테마 선택

### 메뉴 시스템
- DB 기반 Header/Footer 메뉴 관리
- 플러그인 활성화 시 메뉴 자동 등록
- 트리 구조 (부모-자식 관계)
- 권한 제어 (공개/회원/관리자)

### 커뮤니티 (기본 플러그인)
- 게시판 CRUD (무제한 생성)
- 게시글 작성 (Tiptap 에디터)
- 이미지 업로드 (자동 리사이징, WebP 변환)
- 파일 첨부 기능
- 갤러리 뷰 (썸네일 표시)
- 댓글/대댓글
- 리액션 (좋아요, 추천 등)
- 전문 검색 (MySQL FULLTEXT)

### 회원
- 회원가입/로그인
- 이메일 인증
- 소셜 로그인 (Google, Naver, Kakao)
- 브라우저 세션 로그인 (브라우저 종료 시 자동 로그아웃)

### 관리자
- 대시보드 (통계/분석)
- 회원 관리
- 게시판 관리
- 플러그인 관리
- 메뉴 관리
- 홈화면 관리 (위젯)
- 환경설정 (레이아웃, 테마)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | MySQL + Prisma ORM |
| Auth | NextAuth.js (JWT + 브라우저 세션) |
| Editor | Tiptap |
| Image | Sharp |

---

## 요구사항

- Node.js 18+
- MySQL 8.0+
- npm

---

## 설치 방법

### 1. 저장소 클론

```bash
git clone --recurse-submodules https://github.com/nexibase/nexibase.git
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

# NextAuth 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# 소셜 로그인 (선택사항)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
KAKAO_CLIENT_ID=xxx
KAKAO_CLIENT_SECRET=xxx
```

### 4. 데이터베이스 설정

MySQL에서 데이터베이스 생성:

```sql
CREATE DATABASE nexibase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

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

### 플러그인 추가 (선택사항)

```bash
# 경매 플러그인
git submodule add https://github.com/nexibase/plugin-auction.git src/plugins/auction

# 쇼핑몰 플러그인
git submodule add https://github.com/nexibase/plugin-shop.git src/plugins/shop

# DB 동기화
npx prisma db push

# 서버 재시작
npm run dev
```

관리자 페이지 → 플러그인 관리에서 활성화

### 소셜 로그인 설정 (선택사항)

#### Google
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 → API 및 서비스 → 사용자 인증 정보
3. OAuth 2.0 클라이언트 ID 생성
4. 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`
5. `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정

#### Naver
1. [Naver Developers](https://developers.naver.com/) 접속
2. 애플리케이션 등록 → 네이버 로그인 선택
3. 서비스 URL: `http://localhost:3000`
4. Callback URL: `http://localhost:3000/api/auth/callback/naver`
5. `.env`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 설정

#### Kakao
1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 애플리케이션 추가 → 카카오 로그인 활성화
3. Redirect URI: `http://localhost:3000/api/auth/callback/kakao`
4. 동의항목에서 이메일 필수 설정
5. `.env`에 `KAKAO_CLIENT_ID` (REST API 키), `KAKAO_CLIENT_SECRET` 설정

---

## 프로젝트 구조

```
src/
├── app/              # 핵심 라우트 + 자동생성 래퍼
├── plugins/          # 플러그인
│   ├── boards/       # 게시판 (기본)
│   ├── contents/     # 콘텐츠 (기본)
│   ├── policies/     # 약관 (기본)
│   ├── auction/      # 경매 (선택, submodule)
│   └── shop/         # 쇼핑몰 (선택, submodule)
├── layouts/          # 레이아웃 시스템
├── themes/           # 테마 시스템
├── widgets/          # 독립 위젯
├── components/       # 공용 UI
└── lib/              # 유틸리티
```

---

## 새 플러그인 만들기

1. `src/plugins/my-feature/plugin.ts` 작성
2. 필요한 폴더 추가 (`routes/`, `api/`, `widgets/`, `menus/`)
3. DB 모델이 필요하면 `schema.prisma` 작성
4. `npm run dev` → 자동 인식
5. 관리자 페이지에서 활성화

자세한 내용은 [플러그인 개발 가이드](docs/superpowers/specs/2026-04-06-plugin-architecture-design.md)를 참고하세요.

---

## 라이선스

MIT
