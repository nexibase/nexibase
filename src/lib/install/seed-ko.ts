import type { SeedData } from './types'

export const displayName = '한국어'

export const seedKo: SeedData = {
  boards: [
    {
      slug: 'free',
      name: '자유게시판',
      description: '무엇이든 자유롭게 이야기 나눌 수 있는 공간입니다.',
      category: null,
      isActive: true,
      useComment: true,
      useReaction: true,
    },
  ],
  menus: [
    { position: 'header', label: '홈', url: '/', sortOrder: 0 },
    { position: 'header', label: '게시판', url: '/boards/free', sortOrder: 1 },
    { position: 'header', label: '로그인', url: '/login', sortOrder: 2 },
    { position: 'footer', groupName: '정책', label: '이용약관', url: '/policies/terms', sortOrder: 0 },
    { position: 'footer', groupName: '정책', label: '개인정보처리방침', url: '/policies/privacy', sortOrder: 1 },
    { position: 'footer', groupName: '정책', label: '쿠키 정책', url: '/policies/cookie', sortOrder: 2 },
  ],
  widgets: [
    {
      widgetKey: 'welcome-banner',
      zone: 'top',
      title: '환영 배너',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
    {
      widgetKey: 'latest-posts',
      zone: 'center',
      title: '최근 게시글',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
  ],
  contents: [
    {
      slug: 'about',
      title: '사이트 소개',
      content: '<h2>사이트에 오신 것을 환영합니다</h2><p>이 페이지는 사이트 소개 샘플 페이지입니다. 관리자 패널에서 내용을 편집하여 사이트를 소개해 주세요.</p>',
      isPublic: true,
    },
  ],
  policies: [
    {
      slug: 'terms',
      version: '1.0',
      title: '이용약관',
      content: '<h2>이용약관</h2><p>이 내용은 임시 이용약관입니다. 서비스 오픈 전에 관리자 패널에서 실제 이용약관으로 교체해 주세요.</p>',
      isActive: true,
    },
    {
      slug: 'privacy',
      version: '1.0',
      title: '개인정보처리방침',
      content: '<h2>개인정보처리방침</h2><p>이 내용은 임시 개인정보처리방침입니다. 사용자 데이터를 수집하기 전에 관리자 패널에서 실제 개인정보처리방침으로 교체해 주세요.</p>',
      isActive: true,
    },
    {
      slug: 'cookie',
      version: '1.0',
      title: '쿠키 정책',
      content: `<h2>쿠키 정책</h2>
<p>본 사이트는 쿠키를 사용합니다. 이 문서는 어떤 쿠키를 왜 사용하는지, 이용자가 이를 어떻게 통제할 수 있는지 설명합니다. EU 일반 개인정보보호법(GDPR)과 ePrivacy 지침에 따른 정보 제공입니다.</p>

<h3>1. 쿠키란</h3>
<p>쿠키는 웹사이트가 이용자의 기기에 저장하는 작은 텍스트 파일입니다. 로그인 상태 유지처럼 사이트가 동작하는 데 쓰이기도 하고, 방문 통계를 모으는 데 쓰이기도 합니다.</p>
<p>이 정책에서 "쿠키"는 브라우저 쿠키뿐 아니라 로컬 스토리지, 세션 스토리지, 픽셀 등 이용자 기기에 정보를 저장하거나 접근하는 모든 기술을 포함합니다. 유럽개인정보보호이사회(EDPB) Guidelines 2/2023이 이들을 동일하게 취급합니다.</p>

<h3>2. 동의가 필요한 쿠키와 그렇지 않은 쿠키</h3>
<p>이용자가 명시적으로 요청한 서비스를 제공하는 데 반드시 필요한 쿠키는 동의 없이 사용할 수 있습니다(ePrivacy 지침 제5조 제3항). 그 외의 쿠키는 <strong>이용자가 동의하기 전까지 사용되지 않습니다.</strong></p>
<p>분석 쿠키는 동의하신 경우에만 작동합니다. 동의하지 않으셔도 사이트 이용에는 아무런 제한이 없습니다.</p>

<h3>3. 사용하는 쿠키 목록</h3>

<h4>필수 쿠키 (동의 불필요)</h4>
<table>
<thead><tr><th>이름</th><th>목적</th><th>보존 기간</th><th>제공자</th></tr></thead>
<tbody>
<tr><td>nb_consent</td><td>쿠키 동의 여부와 선택한 항목을 기록합니다. 이 쿠키가 있어야 재방문 시 동의를 다시 묻지 않습니다.</td><td>180일</td><td>본 사이트</td></tr>
<tr><td>NEXT_LOCALE</td><td>표시 언어 설정을 기억합니다.</td><td>브라우저 종료 시까지</td><td>본 사이트</td></tr>
<tr><td>next-auth.session-token</td><td>로그인 세션을 유지합니다. 로그인한 경우에만 생성됩니다.</td><td>24시간</td><td>본 사이트</td></tr>
<tr><td>next-auth.csrf-token</td><td>요청 위조(CSRF) 공격을 방지합니다.</td><td>브라우저 종료 시까지</td><td>본 사이트</td></tr>
<tr><td>next-auth.callback-url</td><td>로그인 후 돌아갈 주소를 기억합니다.</td><td>브라우저 종료 시까지</td><td>본 사이트</td></tr>
</tbody>
</table>
<p>운영 환경에서는 위 로그인 관련 쿠키에 <code>__Secure-</code> 접두사가 붙습니다.</p>

<h4>분석 쿠키 (동의 시에만)</h4>
<table>
<thead><tr><th>이름</th><th>목적</th><th>보존 기간</th><th>제공자</th></tr></thead>
<tbody>
<tr><td>_ga</td><td>방문자를 익명으로 구분해 방문 통계를 집계합니다.</td><td>2년</td><td>Google</td></tr>
<tr><td>_ga_&lt;식별자&gt;</td><td>세션 상태를 유지합니다.</td><td>2년</td><td>Google</td></tr>
<tr><td>_gid</td><td>방문자를 익명으로 구분합니다.</td><td>24시간</td><td>Google</td></tr>
</tbody>
</table>
<p>분석에는 Google Analytics를 사용합니다. 동의하지 않으시면 Google Analytics 스크립트 자체가 페이지에 로드되지 않으며, Google로 어떠한 요청도 전송되지 않습니다.</p>

<h3>4. 법적 근거</h3>
<ul>
<li><strong>필수 쿠키</strong> — ePrivacy 지침 제5조 제3항 (b)호의 면제 사유. 이용자가 명시적으로 요청한 서비스 제공에 엄격히 필요합니다.</li>
<li><strong>분석 쿠키</strong> — 이용자의 동의(GDPR 제6조 제1항 (a)호). 동의는 자유롭게 주어지고, 구체적이며, 정보에 입각하고, 명확한 적극적 행위로 표시되어야 합니다.</li>
</ul>

<h3>5. 동의의 변경과 철회</h3>
<p>언제든지 선택을 바꾸거나 철회하실 수 있습니다. 철회는 동의만큼 쉬워야 하며(GDPR 제7조 제3항), 이 페이지 아래의 <strong>쿠키 설정</strong> 버튼에서 바로 하실 수 있습니다.</p>
<p>철회하시면 분석 쿠키는 즉시 삭제되고, 이후 페이지부터는 관련 스크립트가 로드되지 않습니다. 철회는 철회 이전에 이루어진 처리의 적법성에는 영향을 주지 않습니다.</p>
<p>동의를 거부하신 경우, 최소 180일 동안 동의를 다시 요청하지 않습니다.</p>

<h3>6. 브라우저에서 직접 관리하기</h3>
<p>브라우저 설정에서도 쿠키를 차단하거나 삭제하실 수 있습니다. 다만 필수 쿠키까지 차단하면 로그인 유지 등 일부 기능이 정상 동작하지 않을 수 있습니다.</p>
<ul>
<li>Chrome — 설정 &gt; 개인정보 및 보안 &gt; 서드파티 쿠키</li>
<li>Firefox — 설정 &gt; 개인 정보 및 보안 &gt; 쿠키 및 사이트 데이터</li>
<li>Safari — 환경설정 &gt; 개인정보 보호</li>
<li>Edge — 설정 &gt; 쿠키 및 사이트 권한</li>
</ul>

<h3>7. 동의 기록의 보관</h3>
<p>동의를 증명할 수 있도록 동의 이력을 보관합니다(GDPR 제7조 제1항). 보관하는 항목은 익명 식별자, 선택한 항목, 동의 시점, 정책 버전이며, <strong>IP 주소와 브라우저 정보는 저장하지 않습니다.</strong> 철회 시에도 기존 기록을 수정하지 않고 새 기록을 추가합니다.</p>

<h3>8. 제3국 이전</h3>
<p>분석 쿠키에 동의하신 경우, Google Analytics를 통해 수집된 데이터가 대한민국 외 지역에서 처리될 수 있습니다. Google LLC는 EU-미국 데이터 프라이버시 프레임워크에 따라 데이터를 이전받습니다.</p>

<h3>9. 이용자의 권리</h3>
<p>EU/EEA 거주자는 GDPR에 따라 열람, 정정, 삭제, 처리 제한, 이동, 반대할 권리를 가집니다. 감독기구에 민원을 제기할 권리도 있습니다. 자세한 내용과 행사 방법은 개인정보처리방침을 참고하시기 바랍니다.</p>

<h3>10. 정책 변경</h3>
<p>본 정책이 변경되면 이 페이지에 새 버전으로 게시합니다. 사용하는 쿠키가 실질적으로 바뀌는 경우에는 동의를 다시 요청합니다.</p>

<h3>11. 문의</h3>
<p>쿠키 사용에 관한 문의는 사이트 운영자에게 연락해 주시기 바랍니다. 연락처는 개인정보처리방침에 기재되어 있습니다.</p>
`,
      isActive: true,
    },
  ],
}
