"use client"

import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, BarChart3, ExternalLink } from "lucide-react"

interface StepProps {
  number: number
  title: string
  children: React.ReactNode
}

function Step({ number, title, children }: StepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-base font-bold">
            {number}
          </span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

interface ScreenshotProps {
  src: string
  alt: string
  caption?: string
}

function Screenshot({ src, alt, caption }: ScreenshotProps) {
  return (
    <figure className="space-y-2">
      <div className="relative w-full rounded-md border bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto"
          onError={(e) => {
            // Placeholder box when there is no image
            const target = e.currentTarget
            target.style.display = 'none'
            const placeholder = target.nextElementSibling as HTMLDivElement
            if (placeholder) placeholder.style.display = 'flex'
          }}
        />
        <div
          className="hidden w-full aspect-video items-center justify-center text-sm text-muted-foreground bg-muted border-2 border-dashed"
        >
          {/* screenshot pending */}
        </div>
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function GuideContentKo() {
  return (
    <>
      {/* Overview */}
      <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">시작하기 전에 알아두세요</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>이 설정은 처음 한 번만 하면 됩니다.</li>
            <li>중간에 막히는 부분이 있으면 언제든 멈췄다가 이어할 수 있습니다.</li>
            <li>Google 계정과 GA4 속성이 이미 만들어져 있어야 합니다.</li>
            <li>예상 소요 시간: 약 10~15분</li>
          </ul>
        </CardContent>
      </Card>

      {/* Full step summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">전체 단계</CardTitle>
          <CardDescription>아래 6단계를 순서대로 진행합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">1.</span>
              <span>Google Cloud 프로젝트 만들기</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">2.</span>
              <span>Google Analytics Data API 활성화</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">3.</span>
              <span>서비스 계정 만들기 + JSON 키 다운로드</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">4.</span>
              <span>GA4에서 서비스 계정에 권한 부여</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">5.</span>
              <span>NexiBase 설정에 입력</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">6.</span>
              <span>연결 테스트</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-6 max-w-4xl">
        {/* Step 1 */}
        <Step number={1} title="Google Cloud 프로젝트 만들기">
          <p className="text-sm">
            Google Analytics Data API를 사용하려면 Google Cloud 프로젝트가 필요합니다. 이미
            프로젝트가 있다면 이 단계는 건너뛰고 2단계로 가도 됩니다.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Cloud Console <ExternalLink className="h-3 w-3" />
              </a>{' '}
              에 접속합니다.
            </li>
            <li>상단의 프로젝트 선택 드롭다운을 클릭합니다.</li>
            <li>
              <strong>새 프로젝트</strong> 버튼을 클릭합니다.
            </li>
            <li>
              프로젝트 이름을 입력합니다. 예: <code className="px-1 py-0.5 bg-muted rounded">nexibase-analytics</code>
            </li>
            <li>
              <strong>만들기</strong> 버튼을 클릭합니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/01-create-project.png"
            alt="Google Cloud Console 새 프로젝트 만들기"
            caption="새 프로젝트 만들기 화면"
          />

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 팁:</strong> 결제 계정을 연결하라고 나올 수 있는데, GA Data API는
            무료 할당량(일 200,000 토큰) 안에서는 무료입니다. 일반적인 사이트는 무료 한도를 넘지 않습니다.
          </div>
        </Step>

        {/* Step 2 */}
        <Step number={2} title="Google Analytics Data API 활성화">
          <p className="text-sm">
            생성한 프로젝트에서 GA Data API를 활성화해야 합니다.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              좌측 상단 햄버거 메뉴(☰) → <strong>API 및 서비스</strong> → <strong>라이브러리</strong>를 클릭합니다.
            </li>
            <li>
              검색창에 <code className="px-1 py-0.5 bg-muted rounded">Google Analytics Data API</code>를 입력합니다.
            </li>
            <li>검색 결과에서 해당 API를 클릭합니다.</li>
            <li>
              <strong>사용</strong> 버튼을 클릭합니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/02-enable-api.png"
            alt="Google Analytics Data API 활성화 화면"
            caption="API 라이브러리에서 GA Data API 검색 후 활성화"
          />

          <p className="text-sm text-muted-foreground">
            API가 활성화되면 화면이 API 관리 페이지로 바뀝니다.
          </p>
        </Step>

        {/* Step 3 */}
        <Step number={3} title="서비스 계정 만들기 + JSON 키 다운로드">
          <p className="text-sm">
            NexiBase가 GA에 접근할 때 사용할 <strong>서비스 계정</strong>을 만들고, 인증용 JSON 키를 다운로드합니다.
          </p>

          <h4 className="font-semibold text-sm mt-4">3-1. 서비스 계정 만들기</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              좌측 햄버거 메뉴(☰) → <strong>IAM 및 관리자</strong> → <strong>서비스 계정</strong>으로 이동합니다.
            </li>
            <li>
              상단의 <strong>+ 서비스 계정 만들기</strong> 버튼을 클릭합니다.
            </li>
            <li>
              서비스 계정 이름을 입력합니다. 예:{' '}
              <code className="px-1 py-0.5 bg-muted rounded">nexibase-ga-reader</code>
            </li>
            <li>
              <strong>만들고 계속하기</strong>를 클릭합니다.
            </li>
            <li>
              <strong>역할 부여 단계는 건너뛰어도 됩니다.</strong> (GA에서 따로 권한을 부여할 예정)
            </li>
            <li>
              <strong>완료</strong>를 클릭합니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/03-create-service-account.png"
            alt="서비스 계정 만들기 화면"
            caption="서비스 계정 이름과 ID 입력"
          />

          <h4 className="font-semibold text-sm mt-4">3-2. JSON 키 다운로드</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>방금 만든 서비스 계정을 클릭해서 상세 화면으로 들어갑니다.</li>
            <li>
              상단 탭에서 <strong>키</strong>를 선택합니다.
            </li>
            <li>
              <strong>키 추가</strong> → <strong>새 키 만들기</strong>를 클릭합니다.
            </li>
            <li>
              키 유형으로 <strong>JSON</strong>을 선택하고 <strong>만들기</strong>를 클릭합니다.
            </li>
            <li>JSON 파일이 자동으로 컴퓨터에 다운로드됩니다.</li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/04-download-key.png"
            alt="JSON 키 다운로드 화면"
            caption="새 키 만들기 → JSON 선택"
          />

          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm">
            <strong>⚠️ 보안 주의:</strong> 다운로드한 JSON 파일은 GA 데이터를 읽을 수 있는
            인증 정보입니다. 외부에 공개되거나 git에 커밋되지 않도록 주의하세요. NexiBase 설정에
            붙여넣은 후에는 파일을 삭제해도 됩니다.
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 다음 단계에 필요한 정보:</strong>
            <ul className="mt-1 list-disc list-inside">
              <li>다운로드한 JSON 파일</li>
              <li>서비스 계정 이메일 (예: <code className="px-1 py-0.5 bg-background rounded">nexibase-ga-reader@nexibase-analytics.iam.gserviceaccount.com</code>)</li>
            </ul>
            서비스 계정 이메일은 JSON 파일을 텍스트 에디터로 열어 <code className="px-1 py-0.5 bg-background rounded">client_email</code> 항목에서 확인하거나, 서비스 계정 목록 페이지에서 확인할 수 있습니다.
          </div>
        </Step>

        {/* Step 4 */}
        <Step number={4} title="GA4에서 서비스 계정에 권한 부여">
          <p className="text-sm">
            위에서 만든 서비스 계정이 GA4 속성의 데이터를 읽을 수 있도록 <strong>뷰어 권한</strong>을 부여합니다.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Analytics <ExternalLink className="h-3 w-3" />
              </a>
              에 접속합니다.
            </li>
            <li>
              좌측 하단의 <strong>⚙️ 관리</strong>(톱니바퀴) 아이콘을 클릭합니다.
            </li>
            <li>
              속성 열에서 <strong>속성 액세스 관리</strong>를 클릭합니다.
            </li>
            <li>
              우측 상단의 <strong>+ (파란 + 버튼)</strong> → <strong>사용자 추가</strong>를 클릭합니다.
            </li>
            <li>
              <strong>이메일 주소</strong> 칸에 3단계에서 확인한 <strong>서비스 계정 이메일</strong>을 붙여넣습니다.
            </li>
            <li>
              <strong>새 사용자에게 이메일 알림</strong> 체크박스는 <strong>해제</strong>합니다. (서비스 계정은 메일을 받을 수 없음)
            </li>
            <li>
              직접 역할 및 데이터 제한에서 <strong>뷰어</strong>를 선택합니다.
            </li>
            <li>
              우측 상단의 <strong>추가</strong>를 클릭합니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/05-grant-permission.png"
            alt="GA4 속성 액세스 관리"
            caption="서비스 계정 이메일을 뷰어 권한으로 추가"
          />
        </Step>

        {/* Step 5 */}
        <Step number={5} title="NexiBase 설정에 입력">
          <p className="text-sm">
            지금까지 준비한 정보를 NexiBase 관리자 설정에 입력합니다. 입력 전에 GA4에서{' '}
            <strong>Measurement ID</strong>와 <strong>Property ID</strong>를 먼저 확인합니다.
          </p>

          <h4 className="font-semibold text-sm mt-4">5-1. Measurement ID 찾기</h4>
          <p className="text-sm text-muted-foreground">
            <code className="px-1 py-0.5 bg-muted rounded">G-XXXXXXXXXX</code> 형식의 ID로,
            방문자 추적 스크립트에 사용됩니다.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Analytics <ExternalLink className="h-3 w-3" />
              </a>
              접속 → 좌측 하단 <strong>⚙️ 관리</strong> 클릭
            </li>
            <li>
              <strong>속성 설정</strong> → <strong>데이터 수집 및 수정</strong> → <strong>데이터 스트림</strong>을 클릭합니다.
            </li>
            <li>
              목록에서 <strong>웹 스트림</strong>을 클릭합니다. (GA4 추적이 설정된 사이트에 해당)
            </li>
            <li>
              우측 상단의 <strong>측정 ID</strong>(<code className="px-1 py-0.5 bg-muted rounded">G-XXXXXXXXXX</code>)를 복사합니다. 옆에 복사 버튼이 있습니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/06-measurement-id.png"
            alt="GA4 측정 ID 확인 화면"
            caption="데이터 스트림 → 웹 스트림에서 측정 ID 확인"
          />

          <h4 className="font-semibold text-sm mt-4">5-2. Property ID 찾기</h4>
          <p className="text-sm text-muted-foreground">
            숫자만으로 구성된 ID(예: <code className="px-1 py-0.5 bg-muted rounded">412345678</code>)로,
            GA Data API 호출에 사용됩니다. Measurement ID와는 완전히 다른 값입니다.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              같은 GA4 화면에서 <strong>⚙️ 관리</strong> → 속성 열의 <strong>속성 세부정보</strong>를 클릭합니다.
            </li>
            <li>
              페이지 우측 상단의 <strong>속성 ID</strong>(숫자) 값을 확인하고 복사합니다.
            </li>
          </ol>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 헷갈리지 마세요:</strong>
            <ul className="mt-1 space-y-0.5">
              <li>• <strong>Measurement ID</strong>: <code className="px-1 py-0.5 bg-background rounded">G-</code>로 시작하는 ID (예: <code className="px-1 py-0.5 bg-background rounded">G-G1YDVZ5CE4</code>) — 데이터 스트림 위치</li>
              <li>• <strong>Property ID</strong>: 숫자만 (예: <code className="px-1 py-0.5 bg-background rounded">412345678</code>) — 속성 세부정보 위치</li>
            </ul>
          </div>

          <Screenshot
            src="/admin/ga-guide/06b-property-id.png"
            alt="GA4 Property ID 확인 화면"
            caption="속성 세부정보에서 Property ID 확인"
          />

          <h4 className="font-semibold text-sm mt-4">5-3. NexiBase 관리자 설정에 입력</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              <Link href="/admin/settings" className="text-blue-600 dark:text-blue-400 underline">
                관리자 → 환경설정
              </Link>
              으로 이동하여 <strong>Google Analytics</strong> 카드를 찾습니다.
            </li>
            <li>
              <strong>Measurement ID</strong>: 위 5-1에서 복사한 값을 붙여넣습니다. (이미 입력되어 있다면 건너뛰기)
            </li>
            <li>
              <strong>GA4 Property ID</strong>: 위 5-2에서 복사한 숫자를 붙여넣습니다.
            </li>
            <li>
              <strong>Service Account JSON</strong>: <strong>입력</strong> 또는 <strong>변경</strong> 버튼을 클릭한 후, 3단계에서 다운로드한 JSON 파일을 텍스트 에디터로 열어 <strong>전체 내용을 복사</strong>해서 textarea에 붙여넣고 <strong>적용</strong> 버튼을 클릭합니다.
            </li>
            <li>
              페이지 상단의 <strong>저장</strong> 버튼을 클릭합니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/06c-nexibase-settings.png"
            alt="NexiBase 관리자 설정 화면"
            caption="Google Analytics 카드의 3개 필드"
          />
        </Step>

        {/* Step 6 */}
        <Step number={6} title="연결 테스트">
          <p className="text-sm">
            저장이 끝났으면 실제로 GA에 연결되는지 테스트합니다.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Google Analytics 카드 하단의 <strong>연결 테스트</strong> 버튼을 클릭합니다.
            </li>
            <li>
              몇 초 후 결과가 표시됩니다.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/07-connection-test.png"
            alt="연결 테스트 성공 화면"
            caption="✓ 연결됨 메시지가 나오면 성공"
          />

          <h4 className="font-semibold text-sm mt-4">자주 마주치는 에러와 해결</h4>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">PERMISSION_DENIED: User does not have sufficient permissions for this property.</p>
              <p className="text-muted-foreground mt-1">
                → 4단계 GA4 권한 부여가 누락되었거나, 추가한 이메일 주소가 잘못되었습니다. JSON의{' '}
                <code className="px-1 py-0.5 bg-muted rounded">client_email</code> 값과 GA4에 추가한 이메일이 정확히 일치하는지 확인하세요.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">NOT_FOUND: Property not found</p>
              <p className="text-muted-foreground mt-1">
                → GA4 Property ID에 오타가 있거나 잘못된 ID입니다. GA4 관리 → 속성 설정에서 정확한 ID를 다시 확인하세요.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">GA4 설정(...)이 완료되지 않았거나 JSON 형식이 올바르지 않습니다.</p>
              <p className="text-muted-foreground mt-1">
                → JSON을 일부만 복사했거나, 저장 버튼을 누르지 않았을 수 있습니다. JSON 전체를 다시 붙여넣고 저장 버튼을 먼저 클릭한 후 테스트하세요.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">PermissionDenied: Google Analytics Data API has not been used in project ...</p>
              <p className="text-muted-foreground mt-1">
                → 2단계에서 API를 활성화하지 않았습니다. Google Cloud Console로 돌아가 API 라이브러리에서 활성화하세요.
              </p>
            </div>
          </div>
        </Step>

        {/* Done */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">🎉 설정 완료!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              연결 테스트가 성공했다면 모든 설정이 끝났습니다. 이제 홈화면관리에서{' '}
              <strong>방문자 통계</strong> 위젯을 배치하면 사이트에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function GuideContentEn() {
  return (
    <>
      {/* Overview */}
      <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Before you begin</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>You only need to do this once.</li>
            <li>If you get stuck partway through, you can pause and resume anytime.</li>
            <li>You must already have a Google account and a GA4 property.</li>
            <li>Expected time: about 10–15 minutes.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Full step summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">All steps</CardTitle>
          <CardDescription>Follow the six steps below in order</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">1.</span>
              <span>Create a Google Cloud project</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">2.</span>
              <span>Enable the Google Analytics Data API</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">3.</span>
              <span>Create a service account + download the JSON key</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">4.</span>
              <span>Grant the service account access in GA4</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">5.</span>
              <span>Enter the values into NexiBase settings</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-muted-foreground">6.</span>
              <span>Test the connection</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-6 max-w-4xl">
        {/* Step 1 */}
        <Step number={1} title="Create a Google Cloud project">
          <p className="text-sm">
            You need a Google Cloud project to use the Google Analytics Data API. If you
            already have one, you can skip this step and go straight to step 2.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Open the{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Cloud Console <ExternalLink className="h-3 w-3" />
              </a>
              .
            </li>
            <li>Click the project selector dropdown at the top of the page.</li>
            <li>
              Click <strong>New Project</strong>.
            </li>
            <li>
              Enter a project name — for example <code className="px-1 py-0.5 bg-muted rounded">nexibase-analytics</code>.
            </li>
            <li>
              Click <strong>Create</strong>.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/01-create-project.png"
            alt="Creating a new project in Google Cloud Console"
            caption="New project creation screen"
          />

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 Tip:</strong> Google may ask you to link a billing account, but the
            GA Data API is free within the daily quota (200,000 tokens/day). Typical sites
            stay well under that.
          </div>
        </Step>

        {/* Step 2 */}
        <Step number={2} title="Enable the Google Analytics Data API">
          <p className="text-sm">
            Enable the GA Data API on the project you just created.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Click the hamburger menu (☰) → <strong>APIs &amp; Services</strong> → <strong>Library</strong>.
            </li>
            <li>
              Search for <code className="px-1 py-0.5 bg-muted rounded">Google Analytics Data API</code>.
            </li>
            <li>Click the matching API in the search results.</li>
            <li>
              Click <strong>Enable</strong>.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/02-enable-api.png"
            alt="Enabling the Google Analytics Data API"
            caption="Finding and enabling the GA Data API in the API library"
          />

          <p className="text-sm text-muted-foreground">
            Once the API is enabled the page switches to the API management view.
          </p>
        </Step>

        {/* Step 3 */}
        <Step number={3} title="Create a service account + download the JSON key">
          <p className="text-sm">
            Create a <strong>service account</strong> that NexiBase will use to talk to GA,
            then download its authentication JSON key.
          </p>

          <h4 className="font-semibold text-sm mt-4">3-1. Create the service account</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Click the hamburger menu (☰) → <strong>IAM &amp; Admin</strong> → <strong>Service Accounts</strong>.
            </li>
            <li>
              Click <strong>+ Create service account</strong>.
            </li>
            <li>
              Enter a name — for example{' '}
              <code className="px-1 py-0.5 bg-muted rounded">nexibase-ga-reader</code>.
            </li>
            <li>
              Click <strong>Create and continue</strong>.
            </li>
            <li>
              <strong>Skip the role assignment step.</strong> (You will grant access in GA instead.)
            </li>
            <li>
              Click <strong>Done</strong>.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/03-create-service-account.png"
            alt="Creating a service account"
            caption="Enter the service account name and ID"
          />

          <h4 className="font-semibold text-sm mt-4">3-2. Download the JSON key</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Click the service account you just created to open its details.</li>
            <li>
              Switch to the <strong>Keys</strong> tab.
            </li>
            <li>
              Click <strong>Add key</strong> → <strong>Create new key</strong>.
            </li>
            <li>
              Choose <strong>JSON</strong> and click <strong>Create</strong>.
            </li>
            <li>The JSON file is downloaded to your computer automatically.</li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/04-download-key.png"
            alt="Downloading the JSON key"
            caption="Create new key → choose JSON"
          />

          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm">
            <strong>⚠️ Security notice:</strong> The JSON file lets anyone read your GA
            data. Do not publish it or commit it to git. Once you have pasted it into
            NexiBase settings you can safely delete the file.
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 You will need these in the next step:</strong>
            <ul className="mt-1 list-disc list-inside">
              <li>The JSON file you just downloaded.</li>
              <li>The service account email (e.g. <code className="px-1 py-0.5 bg-background rounded">nexibase-ga-reader@nexibase-analytics.iam.gserviceaccount.com</code>).</li>
            </ul>
            You can find the service account email in the JSON file under <code className="px-1 py-0.5 bg-background rounded">client_email</code>, or on the service accounts list page.
          </div>
        </Step>

        {/* Step 4 */}
        <Step number={4} title="Grant the service account access in GA4">
          <p className="text-sm">
            Give the service account you just created <strong>Viewer</strong> access to
            your GA4 property so it can read the data.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Open{' '}
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Analytics <ExternalLink className="h-3 w-3" />
              </a>
              .
            </li>
            <li>
              Click the <strong>⚙️ Admin</strong> (gear) icon in the lower left.
            </li>
            <li>
              Under the property column, click <strong>Property Access Management</strong>.
            </li>
            <li>
              In the upper right, click the <strong>+ (blue plus)</strong> → <strong>Add users</strong>.
            </li>
            <li>
              Paste the <strong>service account email</strong> from step 3 into the{' '}
              <strong>Email addresses</strong> field.
            </li>
            <li>
              <strong>Uncheck</strong> the "Notify new users by email" box. (Service
              accounts cannot receive email.)
            </li>
            <li>
              Under Direct roles and data restrictions, choose <strong>Viewer</strong>.
            </li>
            <li>
              Click <strong>Add</strong> in the upper right.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/05-grant-permission.png"
            alt="GA4 property access management"
            caption="Add the service account email with Viewer permission"
          />
        </Step>

        {/* Step 5 */}
        <Step number={5} title="Enter the values into NexiBase settings">
          <p className="text-sm">
            Enter the information you prepared into the NexiBase admin settings. Before
            you start, look up the <strong>Measurement ID</strong> and{' '}
            <strong>Property ID</strong> in GA4.
          </p>

          <h4 className="font-semibold text-sm mt-4">5-1. Find the Measurement ID</h4>
          <p className="text-sm text-muted-foreground">
            This is an ID in the form <code className="px-1 py-0.5 bg-muted rounded">G-XXXXXXXXXX</code>{' '}
            and is used by the visitor tracking script.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Open{' '}
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
              >
                Google Analytics <ExternalLink className="h-3 w-3" />
              </a>
              , then click <strong>⚙️ Admin</strong> in the lower left.
            </li>
            <li>
              Click <strong>Property settings</strong> → <strong>Data collection and modification</strong> → <strong>Data streams</strong>.
            </li>
            <li>
              Select the <strong>web stream</strong> from the list (the entry that matches
              your tracked site).
            </li>
            <li>
              Copy the <strong>Measurement ID</strong> (<code className="px-1 py-0.5 bg-muted rounded">G-XXXXXXXXXX</code>) from the upper right. There is a copy button next to it.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/06-measurement-id.png"
            alt="Finding the GA4 Measurement ID"
            caption="Data streams → Web stream shows the Measurement ID"
          />

          <h4 className="font-semibold text-sm mt-4">5-2. Find the Property ID</h4>
          <p className="text-sm text-muted-foreground">
            This is a numeric ID (e.g. <code className="px-1 py-0.5 bg-muted rounded">412345678</code>) used by the GA Data API. It is completely different from the Measurement ID.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              From the same GA4 admin screen, click <strong>⚙️ Admin</strong> → <strong>Property details</strong> in the property column.
            </li>
            <li>
              The <strong>Property ID</strong> (numeric) is displayed in the upper right — copy it.
            </li>
          </ol>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <strong>💡 Do not mix these up:</strong>
            <ul className="mt-1 space-y-0.5">
              <li>• <strong>Measurement ID</strong>: starts with <code className="px-1 py-0.5 bg-background rounded">G-</code> (e.g. <code className="px-1 py-0.5 bg-background rounded">G-G1YDVZ5CE4</code>) — found under Data streams.</li>
              <li>• <strong>Property ID</strong>: numeric only (e.g. <code className="px-1 py-0.5 bg-background rounded">412345678</code>) — found under Property details.</li>
            </ul>
          </div>

          <Screenshot
            src="/admin/ga-guide/06b-property-id.png"
            alt="Finding the GA4 Property ID"
            caption="Property details screen shows the Property ID"
          />

          <h4 className="font-semibold text-sm mt-4">5-3. Enter the values into NexiBase admin settings</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Open{' '}
              <Link href="/admin/settings" className="text-blue-600 dark:text-blue-400 underline">
                Admin → Settings
              </Link>
              {' '}and find the <strong>Google Analytics</strong> card.
            </li>
            <li>
              <strong>Measurement ID</strong>: paste the value you copied in 5-1. (Skip
              this if it is already filled in.)
            </li>
            <li>
              <strong>GA4 Property ID</strong>: paste the numeric ID you copied in 5-2.
            </li>
            <li>
              <strong>Service Account JSON</strong>: click <strong>Enter</strong> or{' '}
              <strong>Change</strong>, open the JSON file from step 3 in a text editor,{' '}
              <strong>copy the entire contents</strong>, paste them into the textarea, and click <strong>Apply</strong>.
            </li>
            <li>
              Click <strong>Save</strong> at the top of the page.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/06c-nexibase-settings.png"
            alt="NexiBase admin settings"
            caption="The three fields on the Google Analytics card"
          />
        </Step>

        {/* Step 6 */}
        <Step number={6} title="Test the connection">
          <p className="text-sm">
            Once you have saved, verify that the actual connection to GA works.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Click <strong>Test connection</strong> at the bottom of the Google Analytics card.
            </li>
            <li>
              After a few seconds you will see the result.
            </li>
          </ol>

          <Screenshot
            src="/admin/ga-guide/07-connection-test.png"
            alt="Successful connection test"
            caption="A ✓ Connected message means success"
          />

          <h4 className="font-semibold text-sm mt-4">Common errors and how to fix them</h4>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">PERMISSION_DENIED: User does not have sufficient permissions for this property.</p>
              <p className="text-muted-foreground mt-1">
                → The GA4 access grant in step 4 is missing, or the email you added is
                wrong. Make sure the <code className="px-1 py-0.5 bg-muted rounded">client_email</code> in your JSON file exactly matches the email you added in GA4.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">NOT_FOUND: Property not found</p>
              <p className="text-muted-foreground mt-1">
                → The GA4 Property ID is wrong or has a typo. Double-check it under GA4
                Admin → Property settings.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">GA4 configuration is incomplete or the JSON format is invalid.</p>
              <p className="text-muted-foreground mt-1">
                → You may have pasted only part of the JSON, or forgotten to click Save.
                Paste the full JSON again, click Save first, then run the test.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium text-red-600 dark:text-red-400">PermissionDenied: Google Analytics Data API has not been used in project ...</p>
              <p className="text-muted-foreground mt-1">
                → You did not enable the API in step 2. Go back to Google Cloud Console
                and enable it in the API library.
              </p>
            </div>
          </div>
        </Step>

        {/* Done */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">🎉 Setup complete!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              If the connection test succeeded you are all set. Place the{' '}
              <strong>Visitor Stats</strong> widget from Home widgets and it will appear on your site.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function GaGuidePage() {
  const t = useTranslations('admin')
  const locale = useLocale()
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="settings" />
        <main className="flex-1 lg:ml-0 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                {t('gaGuideTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('gaGuideDesc')}
              </p>
            </div>
            <Link href="/admin/settings">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('backToSettings')}
              </Button>
            </Link>
          </div>

          {locale === 'ko' ? <GuideContentKo /> : <GuideContentEn />}

          <div className="max-w-4xl flex justify-center gap-2 mt-6">
            <Link href="/admin/settings">
              <Button variant="outline">{t('backToSettings')}</Button>
            </Link>
            <Link href="/admin/home-widgets">
              <Button>{t('goToHomeWidgets')}</Button>
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
