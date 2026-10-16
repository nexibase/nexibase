import { Button } from '@/components/ui/button'

const options = [
  { label: '문자만 보내기', sms: true, alimtalk: false, switches: '알림톡 끄기, 문자 켜기', description: '알림톡을 사용하지 않고 문자로 보냅니다.' },
  { label: '알림톡만 보내기', sms: false, alimtalk: true, switches: '알림톡 켜기, 문자 끄기', description: '알림톡으로 보냅니다. 알림톡이 실패해도 문자를 보내지 않습니다.' },
  { label: '알림톡 후 문자 보내기', sms: true, alimtalk: true, switches: '알림톡 켜기, 문자 켜기', description: '알림톡을 먼저 보내고, 최종 실패한 경우에만 문자로 대체합니다. 알림톡이 성공하면 문자를 보내지 않습니다.' },
] as const

export function mobileDeliveryDescription(sms: boolean, alimtalk: boolean) {
  return options.find(option => option.sms === sms && option.alimtalk === alimtalk)?.description || '문자와 알림톡을 보내지 않습니다.'
}

export function MobileDeliveryOptions({ sms, alimtalk, disabled, onSelect }: {
  sms: boolean; alimtalk: boolean; disabled: boolean; onSelect: (sms: boolean, alimtalk: boolean) => void
}) {
  return <div className="space-y-3">
    <div><h3 className="font-medium">문자·알림톡 발송 방식</h3><p className="mt-1 text-sm text-muted-foreground">원하는 방식을 선택하면 아래 문자·알림톡 스위치에 반영됩니다. 메일은 별도로 설정합니다.</p></div>
    <div className="grid gap-3 lg:grid-cols-3">{options.map(option => {
      const selected = sms === option.sms && alimtalk === option.alimtalk
      return <Button key={option.label} type="button" variant="outline" disabled={disabled} aria-label={option.label} aria-pressed={selected}
        onClick={() => onSelect(option.sms, option.alimtalk)}
        className={`h-auto min-w-0 flex-col items-start justify-start whitespace-normal p-4 text-left ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}>
        <span className="flex w-full flex-wrap items-center justify-between gap-2"><span className="font-semibold">{option.label}</span>{selected && <span className="text-xs text-primary">선택됨</span>}</span>
        <span className="text-xs text-muted-foreground">{option.switches}</span>
        <span className="text-sm font-normal leading-relaxed">{option.description}</span>
      </Button>
    })}</div>
    <p className="rounded-md bg-muted p-3 text-sm" aria-label="현재 문자·알림톡 발송 방식">현재 설정: {mobileDeliveryDescription(sms, alimtalk)}</p>
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>자동 발송하려면 이벤트별 발송 설정에서도 사용할 채널을 켜세요. 회원의 수신 동의·연락처, 연결 정보와 발송 모드도 적용됩니다.</p>
      <p>알림톡에는 승인된 템플릿이 필요하고, 대체 문자에는 문자 본문이 필요합니다. 설정·템플릿 문제로 알림톡 발송이 생략되면 문자로 자동 전환하지 않습니다.</p>
      <p>원하는 방식을 선택한 뒤 상단의 설정 저장을 눌러 적용하세요.</p>
    </div>
  </div>
}
