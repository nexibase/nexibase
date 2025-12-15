/**
 * Prebuild 스크립트
 * 환경 변수 NEXT_PUBLIC_THEME에 따라 테마 index.ts 생성
 *
 * 사용법:
 * 1. .env 파일에서 NEXT_PUBLIC_THEME=custom 설정
 * 2. npm run build 실행 (자동으로 이 스크립트 실행됨)
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
const indexPath = path.join(themesDir, 'index.ts')

console.log(`[prebuild] 테마: ${theme}`)

// 테마 폴더 존재 확인
if (!fs.existsSync(themeDir)) {
  console.log(`[prebuild] 경고: ${theme} 테마 폴더가 없습니다. default 테마를 사용합니다.`)
  process.env.NEXT_PUBLIC_THEME = 'default'
}

const actualTheme = fs.existsSync(themeDir) ? theme : 'default'

// 테마 폴더 내 컴포넌트 확인
const components = ['Header', 'Footer', 'HomePage']
const availableComponents = components.filter(comp => {
  const compPath = path.join(themesDir, actualTheme, `${comp}.tsx`)
  return fs.existsSync(compPath)
})

if (availableComponents.length === 0) {
  console.error(`[prebuild] 에러: ${actualTheme} 테마에 컴포넌트가 없습니다.`)
  process.exit(1)
}

// index.ts 생성
const indexContent = `/**
 * 테마 컴포넌트 export (자동 생성됨)
 *
 * 현재 테마: ${actualTheme}
 * 생성 시간: ${new Date().toISOString()}
 *
 * 테마 변경 방법:
 * 1. .env 파일에서 NEXT_PUBLIC_THEME 값 변경
 * 2. npm run build 실행
 */

${availableComponents.map(comp =>
  `export { default as ${comp} } from './${actualTheme}/${comp}'`
).join('\n')}
`

fs.writeFileSync(indexPath, indexContent)
console.log(`[prebuild] src/themes/index.ts 생성 완료 (테마: ${actualTheme})`)
console.log(`[prebuild] 포함된 컴포넌트: ${availableComponents.join(', ')}`)
