/**
 * Prebuild 스크립트
 * 환경 변수 NEXT_PUBLIC_THEME에 따라 테마 index.ts 생성
 *
 * 사용법:
 * 1. .env 파일에서 NEXT_PUBLIC_THEME=user 설정
 * 2. npm run build 실행 (자동으로 이 스크립트 실행됨)
 *
 * 동작 방식:
 * - 지정 테마에 컴포넌트가 있으면 해당 컴포넌트 사용
 * - 없으면 default 테마에서 fallback
 *
 * 폴더 구조:
 * src/themes/default/
 * ├── Header.tsx, Footer.tsx, HomePage.tsx
 * ├── auth/LoginPage.tsx, SignupPage.tsx
 * ├── board/BoardListPage.tsx, BoardPostPage.tsx, ...
 * ├── content/ContentPage.tsx
 * ├── policy/PolicyPage.tsx
 * └── admin/...
 */

const fs = require('fs')
const path = require('path')

// .env 파일에서 환경 변수 로드
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value && !process.env[key]) {
        process.env[key.trim()] = value.trim()
      }
    })
  }
}

loadEnv()

const theme = process.env.NEXT_PUBLIC_THEME || 'default'
const themesDir = path.join(process.cwd(), 'src', 'themes')
const themeDir = path.join(themesDir, theme)
const defaultDir = path.join(themesDir, 'default')
const indexPath = path.join(themesDir, 'index.ts')

console.log(`[prebuild] 테마: ${theme}`)

// 테마 폴더 존재 확인
if (theme !== 'default' && !fs.existsSync(themeDir)) {
  console.log(`[prebuild] 경고: ${theme} 테마 폴더가 없습니다. default 테마를 사용합니다.`)
}

// 컴포넌트 목록 (폴더/파일명)
const components = [
  // 루트 레벨 컴포넌트
  { name: 'Header', path: 'Header' },
  { name: 'Footer', path: 'Footer' },
  { name: 'HomePage', path: 'HomePage' },
  // auth
  { name: 'LoginPage', path: 'auth/LoginPage' },
  { name: 'SignupPage', path: 'auth/SignupPage' },
  // board
  { name: 'BoardListPage', path: 'board/BoardListPage' },
  { name: 'BoardPostPage', path: 'board/BoardPostPage' },
  { name: 'BoardWritePage', path: 'board/BoardWritePage' },
  { name: 'BoardEditPage', path: 'board/BoardEditPage' },
  // content
  { name: 'ContentPage', path: 'content/ContentPage' },
  // policy
  { name: 'PolicyPage', path: 'policy/PolicyPage' },
  // search
  { name: 'SearchPage', path: 'search/SearchPage' },
  // shop
  { name: 'ShopProductImages', path: 'shop/ProductImages' },
  { name: 'ShopReviewSection', path: 'shop/ReviewSection' },
  { name: 'ShopQnaSection', path: 'shop/QnaSection' },
]

// 각 컴포넌트별로 어느 테마에서 가져올지 결정
const componentSources = components.map(comp => {
  const themeCompPath = path.join(themeDir, `${comp.path}.tsx`)
  const defaultCompPath = path.join(defaultDir, `${comp.path}.tsx`)

  // 지정 테마에 있으면 지정 테마에서, 없으면 default에서
  if (theme !== 'default' && fs.existsSync(themeCompPath)) {
    return { name: comp.name, path: comp.path, source: theme }
  } else if (fs.existsSync(defaultCompPath)) {
    return { name: comp.name, path: comp.path, source: 'default' }
  } else {
    return { name: comp.name, path: comp.path, source: null }
  }
})

// 사용 가능한 컴포넌트만 필터
const availableComponents = componentSources.filter(c => c.source !== null)

if (availableComponents.length === 0) {
  console.error(`[prebuild] 에러: 사용 가능한 컴포넌트가 없습니다.`)
  process.exit(1)
}

// index.ts 생성
const customComponents = availableComponents.filter(c => c.source === theme)
const fallbackComponents = availableComponents.filter(c => c.source === 'default' && theme !== 'default')

const indexContent = `/**
 * 테마 컴포넌트 export (자동 생성됨)
 *
 * 현재 테마: ${theme}
 * 생성 시간: ${new Date().toISOString()}
 *
 * 테마 변경 방법:
 * 1. .env 파일에서 NEXT_PUBLIC_THEME 값 변경
 * 2. npm run build 실행
 */

${availableComponents.map(c =>
  `export { default as ${c.name} } from './${c.source}/${c.path}'`
).join('\n')}
`

fs.writeFileSync(indexPath, indexContent)
console.log(`[prebuild] src/themes/index.ts 생성 완료`)
console.log(`[prebuild] 총 ${availableComponents.length}개 컴포넌트`)

if (theme !== 'default') {
  if (customComponents.length > 0) {
    console.log(`[prebuild] ${theme} 테마: ${customComponents.map(c => c.name).join(', ')}`)
  }
  if (fallbackComponents.length > 0) {
    console.log(`[prebuild] default fallback: ${fallbackComponents.map(c => c.name).join(', ')}`)
  }
}
