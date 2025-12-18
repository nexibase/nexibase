# NexiBase

> **Next.js 기반 CMS + 커뮤니티 + 쇼핑몰 통합 솔루션**

**NexiBase**는 **Next.js + I + Base**의 합성어로, Next.js를 기반으로 한 차세대 웹 서비스의 기본 구조(Base)를 의미합니다.

---

## 주요 기능

### 커뮤니티
- 게시판 CRUD (무제한 생성)
- 게시글 작성 (Tiptap 에디터)
- 이미지 업로드 (자동 리사이징, WebP 변환)
- 댓글/대댓글
- 리액션 (좋아요, 추천 등)
- 전문 검색 (MySQL FULLTEXT)

### 쇼핑몰
- 상품 관리 (카테고리, 다중 이미지)
- 3단계 옵션 (색상/사이즈/소재 등)
- 장바구니, 위시리스트
- 주문/결제 (KG이니시스 연동)
- 배송비 관리 (지역별, 무료배송 조건)
- 주문 상태 관리 (결제대기 → 배송완료)
- 상품 리뷰/Q&A

### 회원
- 회원가입/로그인
- 이메일 인증 (준비 중)
- 소셜 로그인 (준비 중)
- 배송지 관리

### 관리자
- 대시보드
- 회원 관리
- 게시판 관리
- 상품/주문 관리
- 리뷰/Q&A 관리
- 쇼핑몰 설정 (PG, 배송비 등)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | MySQL + Prisma ORM |
| Editor | Tiptap |
| Image | Sharp |
| Payment | KG이니시스 |

---

## 요구사항

- Node.js 18+
- MySQL 8.0+
- npm 또는 yarn

---

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/gnuboard/nexibase.git
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

### 쇼핑몰 설정

1. http://localhost:3000/admin/shop/settings 접속
2. 쇼핑몰 기본 정보 입력
3. PG 설정 (이니시스 MID, SignKey 등)
4. 배송비 설정

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 인증 (로그인, 회원가입)
│   ├── admin/           # 관리자 페이지
│   ├── api/             # API 라우트
│   ├── board/           # 게시판
│   └── shop/            # 쇼핑몰
├── components/          # 공통 컴포넌트
└── lib/                 # 유틸리티
```

---

## 테마 커스터마이징

라우트(URL)는 그대로 유지하면서 **UI 컴포넌트만 교체**할 수 있습니다.

### 테마 구조

```
src/themes/
├── default/           # 기본 테마 (git 추적)
│   └── HomePage.tsx
└── custom/            # 커스텀 테마 (git 무시)
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

### 주의사항

- `src/themes/custom/` 폴더는 git에서 무시되어 업데이트 영향 없음
- 되돌리기: 해당 파일 삭제하면 default 테마 사용

---

## 검색 기능

MySQL FULLTEXT 인덱스를 활용한 고성능 검색을 지원합니다.

```
/search?q=검색어&board=free&sort=relevance
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `q` | 검색어 (2자 이상) | 필수 |
| `board` | 게시판 slug | all |
| `sort` | 정렬 (relevance, latest, popular) | relevance |

---

## 라이선스

MIT
