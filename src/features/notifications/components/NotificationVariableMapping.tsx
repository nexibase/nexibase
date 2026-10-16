import { Label } from '@/components/ui/label'
import { changeVariableMapping, templateVariables, variableSources, type VariableMapping } from '@/lib/notifications/template-variables'

const useLabels = { alimtalk: '알림톡', sms: '문자', buttons: '알림톡 버튼' }
export function NotificationVariableMapping({ eventType, label, alimtalkTemplate, smsTemplate, buttonsText, mapping, disabled, onChange }: {
  eventType: string; label: string; alimtalkTemplate: string; smsTemplate: string; buttonsText: string
  mapping: VariableMapping; disabled: boolean; onChange: (mapping: VariableMapping) => void
}) {
  const variables = templateVariables({ alimtalkTemplate, smsTemplate, buttonsText, variableMapping: mapping })
  const sources = variableSources(eventType)
  return <section className="rounded-lg border p-4 space-y-4" aria-label={`${label} 공통 변수 매핑`}>
    <h4 className="font-medium">공통 변수 매핑</h4>
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>문자 본문과 알림톡 본문·버튼의 {'#{변수명}'}을 실제 발송 데이터로 바꿉니다. 두 채널에 같은 연결을 사용합니다.</p>
      <p>템플릿에서 찾은 변수마다 연결할 데이터를 선택하세요. 기본 변수는 별도로 연결하지 않아도 자동으로 채워집니다. 변경 후 상단의 설정 저장을 누르세요.</p>
    </div>
    <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
      <p className="font-medium">입력 예시</p>
      <p>본문: <code>{'#{고객명}님, #{내용}'}</code></p>
      <p>연결: 고객명 → 회원 이름 / 닉네임, 내용 → 알림 내용</p>
      <p>발송 예시: 홍길동님, 작성한 게시글에 새 댓글이 달렸습니다.</p>
    </div>
    {!variables.length ? <p className="text-sm text-muted-foreground">본문이나 버튼에 {'#{고객명}'}처럼 변수를 입력하면 아래에 연결 항목이 나타납니다.</p> : <div className="space-y-3">
      {variables.map((variable, index) => {
        const savedSource = Object.hasOwn(mapping, variable.name) ? mapping[variable.name] : ''
        const defaultSource = sources.find(source => source.key === variable.name)
        const source = sources.find(source => source.key === (savedSource || variable.name))
        const unknownSource = !!savedSource && !sources.some(source => source.key === savedSource)
        const id = `variable-${eventType}-${index}`
        return <div key={variable.name} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-1"><Label htmlFor={id} className="break-all">{'#{' + variable.name + '}'}</Label>
            <p className="text-xs text-muted-foreground">{variable.uses.length ? variable.uses.map(use => useLabels[use]).join(' · ') : '현재 템플릿에서 사용하지 않는 저장된 연결'}</p>
          </div>
          <div className="min-w-0 space-y-1"><select id={id} aria-label={`${label} ${variable.name}에 연결할 데이터`} disabled={disabled} value={savedSource}
            className="h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            onChange={event => onChange(changeVariableMapping(mapping, variable.name, event.target.value))}>
            <option value="">{defaultSource ? `기본값 사용 · ${defaultSource.label}` : '연결할 데이터를 선택하세요'}</option>
            {unknownSource && <option value={savedSource}>현재 저장된 연결 · {savedSource} (제공 여부 확인 필요)</option>}
            <optgroup label="기본 알림 데이터">{sources.slice(0, 5).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</optgroup>
            {sources.length > 5 && <optgroup label="주문 데이터">{sources.slice(5).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</optgroup>}
          </select>
            <p className={`text-xs ${source ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}`}>
              {source ? `예시 값: ${source.example}` : unknownSource ? '기존 연결을 유지합니다. 이 이벤트에서 해당 데이터를 제공하는지 확인하세요.' : variable.uses.length ? '연결 필요 · 발송 전에 데이터를 선택하세요.' : '선택을 비우면 저장된 연결을 삭제합니다.'}
            </p>
          </div>
        </div>
      })}
    </div>}
    <p className="text-xs text-muted-foreground">위 값은 이해를 돕기 위한 예시이며 실제 발송 시 회원·알림·주문 정보로 바뀝니다. 주문 번호·상태·금액·운송장·주문자 이름은 주문 이벤트에서만 선택할 수 있습니다.</p>
  </section>
}
