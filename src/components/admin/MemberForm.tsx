"use client"

import { useState, useEffect, useCallback } from "react"
import Script from "next/script"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Mail, MapPin, Shield, Settings, Lock, FileText, Calendar } from "lucide-react"
import { MemberFormData, MemberFormProps, Member } from "@/lib/types/member"
import { Textarea } from "@/components/ui/textarea"

// Daum 우편번호 API 타입 선언
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          roadAddress: string;
          jibunAddress: string;
          buildingName: string;
          apartment: string;
        }) => void;
        width?: string;
        height?: string;
      }) => {
        open: () => void;
      };
    };
  }
}

export function MemberForm({ mode, memberId, onCancel, onSuccess }: MemberFormProps) {
  const [loading, setLoading] = useState(false)
  const [idChecking, setIdChecking] = useState(false)
  const [nickChecking, setNickChecking] = useState(false)
  const [emailChecking, setEmailChecking] = useState(false)
  
  // 중복 체크 상태들
  const [idStatus, setIdStatus] = useState<{
    available: boolean | null
    message: string
    checked: boolean
  }>({
    available: null,
    message: "",
    checked: false
  })
  
  const [nickStatus, setNickStatus] = useState<{
    available: boolean | null
    message: string
    checked: boolean
  }>({
    available: null,
    message: "",
    checked: false
  })
  
  const [emailStatus, setEmailStatus] = useState<{
    available: boolean | null
    message: string
    checked: boolean
  }>({
    available: null,
    message: "",
    checked: false
  })
  
  const [setTodayLeave, setSetTodayLeave] = useState(false)
  const [setTodayIntercept, setSetTodayIntercept] = useState(false)
  
  const [formData, setFormData] = useState<MemberFormData>({
    mb_id: "",
    mb_password: "",
    mb_password_confirm: "",
    mb_name: "",
    mb_nick: "",
    mb_email: "",
    mb_hp: "",
    mb_tel: "",
    mb_level: 2,
    mb_certify: "phone",
    mb_adult: 0,
    mb_mailling: 1,
    mb_sms: 1,
    mb_open: 1,
    mb_point: 0,
    mb_homepage: "",
    mb_zip: "",
    mb_addr1: "",
    mb_addr2: "",
    mb_addr3: "",
    mb_signature: "",
    mb_memo: "",
    mb_profile: "",
    mb_icon: "",
    mb_leave_date: "",
    mb_intercept_date: "",
    mb_1: "",
    mb_2: "",
    mb_3: "",
    mb_4: "",
    mb_5: "",
    mb_6: "",
    mb_7: "",
    mb_8: "",
    mb_9: "",
    mb_10: ""
  })

  // Edit 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (mode === 'edit' && memberId) {
      const fetchMember = async () => {
        try {
          setLoading(true)
          const response = await fetch(`/api/admin/members/${memberId}`)
          const data = await response.json()

          if (data.success) {
            const member: Member = data.member
            setFormData({
              mb_id: member.mb_id,
              mb_password: "",
              mb_password_confirm: "",
              mb_name: member.mb_name || "",
              mb_nick: member.mb_nick || "",
              mb_email: member.mb_email || "",
              mb_hp: member.mb_hp || "",
              mb_tel: member.mb_tel || "",
              mb_level: member.mb_level || 2,
              mb_certify: member.mb_certify || "phone",
              mb_adult: member.mb_adult || 0,
              mb_mailling: member.mb_mailling || 1,
              mb_sms: member.mb_sms || 1,
              mb_open: member.mb_open || 1,
              mb_point: member.mb_point || 0,
              mb_homepage: "",
              mb_zip: "",
              mb_addr1: "",
              mb_addr2: "",
              mb_addr3: "",
              mb_signature: member.mb_signature || "",
              mb_memo: member.mb_memo || "",
              mb_profile: member.mb_profile || "",
              mb_icon: "",
              mb_leave_date: member.mb_leave_date || "",
              mb_intercept_date: member.mb_intercept_date || "",
              mb_1: "",
              mb_2: "",
              mb_3: "",
              mb_4: "",
              mb_5: "",
              mb_6: "",
              mb_7: "",
              mb_8: "",
              mb_9: "",
              mb_10: ""
            })

            // Edit 모드에서는 아이디 중복 체크를 건너뛰고 기본적으로 사용 가능으로 설정
            setIdStatus({
              available: true,
              message: "기존 아이디입니다.",
              checked: true
            })
          } else {
            alert(data.error || '회원 정보를 불러오는 중 오류가 발생했습니다.')
          }
        } catch (error) {
          console.error('회원 정보 조회 실패:', error)
          alert('네트워크 오류가 발생했습니다.')
        } finally {
          setLoading(false)
        }
      }

      fetchMember()
    }
  }, [mode, memberId])

  // 유효성 검사 함수들
  const validateId = (id: string) => {
    if (!id.trim()) {
      return { valid: false, message: "아이디를 입력해주세요." }
    }
    if (id.length < 3) {
      return { valid: false, message: "아이디는 3자 이상이어야 합니다." }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      return { valid: false, message: "아이디는 영문, 숫자, 언더스코어만 사용 가능합니다." }
    }
    return { valid: true, message: "" }
  }

  const validateNick = (nick: string) => {
    if (!nick.trim()) {
      return { valid: false, message: "닉네임을 입력해주세요." }
    }
    if (nick.length < 2) {
      return { valid: false, message: "닉네임은 2자 이상이어야 합니다." }
    }
    if (nick.length > 20) {
      return { valid: false, message: "닉네임은 20자 이하여야 합니다." }
    }
    return { valid: true, message: "" }
  }

  const validateEmail = (email: string) => {
    if (!email.trim()) {
      return { valid: false, message: "이메일을 입력해주세요." }
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return { valid: false, message: "올바른 이메일 형식이 아닙니다." }
    }
    return { valid: true, message: "" }
  }

  // 디바운스된 중복 체크 함수들
  const debouncedCheckId = useCallback(
    (async (id: string) => {
      // Edit 모드에서는 아이디 중복 체크 생략 (아이디는 변경불가)
      if (mode === 'edit') return

      const idValidation = validateId(id)
      if (!idValidation.valid) {
        setIdStatus({
          available: false,
          message: idValidation.message,
          checked: false
        })
        return
      }

      setIdChecking(true)
      try {
        const response = await fetch('/api/members/check-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mb_id: id }),
        })

        const data = await response.json()

        if (response.ok) {
          setIdStatus({
            available: data.available,
            message: data.message,
            checked: true
          })
        } else {
          setIdStatus({
            available: false,
            message: data.error || '중복 확인 중 오류가 발생했습니다.',
            checked: false
          })
        }
      } catch (error) {
        console.error('아이디 중복 확인 에러:', error)
        setIdStatus({
          available: false,
          message: '네트워크 오류가 발생했습니다.',
          checked: false
        })
      } finally {
        setIdChecking(false)
      }
    }),
    [mode]
  )

  const debouncedCheckNick = useCallback(
    (async (nick: string) => {
      const nickValidation = validateNick(nick)
      if (!nickValidation.valid) {
        setNickStatus({
          available: false,
          message: nickValidation.message,
          checked: false
        })
        return
      }

      setNickChecking(true)
      try {
        const response = await fetch('/api/members/check-nick', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            mb_nick: nick,
            // Edit 모드일 때는 현재 회원 제외
            exclude_id: mode === 'edit' ? memberId : undefined
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setNickStatus({
            available: data.available,
            message: data.message,
            checked: true
          })
        } else {
          setNickStatus({
            available: false,
            message: data.error || '중복 확인 중 오류가 발생했습니다.',
            checked: false
          })
        }
      } catch (error) {
        console.error('닉네임 중복 확인 에러:', error)
        setNickStatus({
          available: false,
          message: '네트워크 오류가 발생했습니다.',
          checked: false
        })
      } finally {
        setNickChecking(false)
      }
    }),
    [mode, memberId]
  )

  const debouncedCheckEmail = useCallback(
    (async (email: string) => {
      const emailValidation = validateEmail(email)
      if (!emailValidation.valid) {
        setEmailStatus({
          available: false,
          message: emailValidation.message,
          checked: false
        })
        return
      }

      setEmailChecking(true)
      try {
        const response = await fetch('/api/members/check-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email,
            // Edit 모드일 때는 현재 회원 제외
            exclude_id: mode === 'edit' ? memberId : undefined
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setEmailStatus({
            available: data.available,
            message: data.message,
            checked: true
          })
        } else {
          setEmailStatus({
            available: false,
            message: data.error || '중복 확인 중 오류가 발생했습니다.',
            checked: false
          })
        }
      } catch (error) {
        console.error('이메일 중복 확인 에러:', error)
        setEmailStatus({
          available: false,
          message: '네트워크 오류가 발생했습니다.',
          checked: false
        })
      } finally {
        setEmailChecking(false)
      }
    }),
    [mode, memberId]
  )

  // 자동 중복 체크 useEffect들
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (formData.mb_id.trim() && mode === 'create') {
      timeoutId = setTimeout(() => {
        debouncedCheckId(formData.mb_id)
      }, 500)
    } else if (mode === 'create') {
      setIdStatus({
        available: null,
        message: "",
        checked: false
      })
    }
    return () => clearTimeout(timeoutId)
  }, [formData.mb_id, debouncedCheckId, mode])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (formData.mb_nick.trim()) {
      timeoutId = setTimeout(() => {
        debouncedCheckNick(formData.mb_nick)
      }, 500)
    } else {
      setNickStatus({
        available: null,
        message: "",
        checked: false
      })
    }
    return () => clearTimeout(timeoutId)
  }, [formData.mb_nick, debouncedCheckNick])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (formData.mb_email.trim()) {
      timeoutId = setTimeout(() => {
        debouncedCheckEmail(formData.mb_email)
      }, 500)
    } else {
      setEmailStatus({
        available: null,
        message: "",
        checked: false
      })
    }
    return () => clearTimeout(timeoutId)
  }, [formData.mb_email, debouncedCheckEmail])

  const handleInputChange = (field: keyof MemberFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 오늘 날짜로 설정하는 함수들
  const handleTodayLeave = (checked: boolean) => {
    setSetTodayLeave(checked)
    if (checked) {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      setFormData(prev => ({ ...prev, mb_leave_date: today }))
    }
  }

  const handleTodayIntercept = (checked: boolean) => {
    setSetTodayIntercept(checked)
    if (checked) {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      setFormData(prev => ({ ...prev, mb_intercept_date: today }))
    }
  }

  // 주소 검색 함수
  const handleAddressSearch = () => {
    if (!window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    new window.daum.Postcode({
      oncomplete: function(data) {
        let addr = ''
        let extraAddr = ''

        if (data.roadAddress !== '') {
          addr = data.roadAddress
        } else {
          addr = data.jibunAddress
        }

        if (data.roadAddress !== '') {
          if (data.buildingName !== '') {
            extraAddr = data.buildingName
          }
          if (extraAddr !== '') {
            addr += ' (' + extraAddr + ')'
          }
        }

        setFormData(prev => ({
          ...prev,
          mb_zip: data.zonecode,
          mb_addr1: addr
        }))
      },
      width: '500',
      height: '600'
    }).open()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 기본 유효성 검증
    const idValidation = validateId(formData.mb_id)
    if (!idValidation.valid) {
      alert(idValidation.message)
      return
    }

    if (mode === 'create' && (!idStatus.checked || !idStatus.available)) {
      alert("사용할 수 없는 아이디입니다.")
      return
    }

    // Create 모드에서만 비밀번호 필수
    if (mode === 'create' && !formData.mb_password) {
      alert("비밀번호를 입력해주세요.")
      document.getElementById('mb_password')?.focus()
      return
    }

    if (!formData.mb_name.trim()) {
      alert("이름을 입력해주세요.")
      document.getElementById('mb_name')?.focus()
      return
    }

    if (!formData.mb_nick.trim()) {
      alert("닉네임을 입력해주세요.")
      document.getElementById('mb_nick')?.focus()
      return
    }

    if (!formData.mb_email.trim()) {
      alert("이메일을 입력해주세요.")
      document.getElementById('mb_email')?.focus()
      return
    }

    if (formData.mb_nick.trim()) {
      const nickValidation = validateNick(formData.mb_nick)
      if (!nickValidation.valid) {
        alert(nickValidation.message)
        return
      }

      if (!nickStatus.checked || !nickStatus.available) {
        alert("사용할 수 없는 닉네임입니다.")
        return
      }
    }

    const emailValidation = validateEmail(formData.mb_email)
    if (!emailValidation.valid) {
      alert(emailValidation.message)
      return
    }

    if (!emailStatus.checked || !emailStatus.available) {
      alert("사용할 수 없는 이메일입니다.")
      return
    }

    try {
      setLoading(true)
      
      const url = mode === 'create' 
        ? '/api/admin/members'
        : `/api/admin/members/${memberId}`
      
      const method = mode === 'create' ? 'POST' : 'PUT'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        alert(`회원이 성공적으로 ${mode === 'create' ? '추가' : '수정'}되었습니다.`)
        onSuccess()
      } else {
        alert(data.error || `회원 ${mode === 'create' ? '추가' : '수정'} 중 오류가 발생했습니다.`)
      }
    } catch (error) {
      console.error(`회원 ${mode} 실패:`, error)
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Enter 키 핸들러 수정
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Textarea에서 Shift+Enter는 줄바꿈을 위해 허용
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA') {
        return
      }
      
      e.preventDefault()
      handleSubmit(e as React.FormEvent)
    }
  }

  return (
    <>
      {/* Daum 우편번호 API 스크립트 로드 */}
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
        onError={(e) => {
          console.error('Daum Postcode API 로드 실패:', e)
        }}
      />
      
      <div className="space-y-6" onKeyDown={handleKeyDown}>
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onCancel} className="text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'create' ? '회원 추가' : '회원 수정'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {mode === 'create' ? '새로운 회원 정보를 입력해주세요' : '회원 정보를 수정해주세요'}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={
              loading || 
              !validateId(formData.mb_id).valid || 
              (mode === 'create' && (!idStatus.checked || !idStatus.available)) ||
              (formData.mb_nick.trim() && (!nickStatus.checked || !nickStatus.available)) ||
              !validateEmail(formData.mb_email).valid ||
              !emailStatus.checked ||
              !emailStatus.available ||
              (mode === 'create' && !formData.mb_password) ||
              !formData.mb_name ||
              !formData.mb_nick ||
              !formData.mb_email
            }
            className="bg-red-600 hover:bg-red-700 text-sm"
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "저장 중..." : (mode === 'create' ? '회원 추가' : '회원 수정')}
          </Button>
        </div>

        {/* 1. 기본 계정 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-blue-600" />
              기본 계정 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 아이디 / 비밀번호 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_id" className="text-xs font-medium">아이디 *</Label>
                <Input
                  id="mb_id"
                  maxLength={20}
                  value={formData.mb_id}
                  onChange={(e) => handleInputChange('mb_id', e.target.value)}
                  autoComplete="off"
                  className={`text-sm ${mode === 'edit' ? 'bg-gray-100' : ''}`}
                  required
                  disabled={mode === 'edit'} // Edit 모드에서는 아이디 변경 불가
                />
                {formData.mb_id && (
                  <div className={`text-xs ${
                    idStatus.available === true ? 'text-green-600' : 
                    idStatus.available === false ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {idChecking && "확인 중..."}
                    {!idChecking && idStatus.message}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mb_password" className="text-xs font-medium">
                  비밀번호 {mode === 'create' ? '*' : '(변경시에만 입력)'}
                </Label>
                <Input
                  id="mb_password"
                  type="password"
                  value={formData.mb_password}
                  onChange={(e) => handleInputChange('mb_password', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                  required={mode === 'create'}
                />
              </div>
            </div>

            {/* 이름 / 닉네임 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_name" className="text-xs font-medium">이름(실명) *</Label>
                <Input
                  id="mb_name"
                  value={formData.mb_name}
                  onChange={(e) => handleInputChange('mb_name', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mb_nick" className="text-xs font-medium">닉네임 *</Label>
                <Input
                  id="mb_nick"
                  value={formData.mb_nick}
                  onChange={(e) => handleInputChange('mb_nick', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                />
                {formData.mb_nick && (
                  <div className={`text-xs ${
                    nickStatus.available === true ? 'text-green-600' : 
                    nickStatus.available === false ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {nickChecking && "확인 중..."}
                    {!nickChecking && nickStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* 이메일 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_email" className="text-xs font-medium">이메일 *</Label>
                <Input
                  id="mb_email"
                  type="email"
                  value={formData.mb_email}
                  onChange={(e) => handleInputChange('mb_email', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                  required
                />
                {formData.mb_email && (
                  <div className={`text-xs ${
                    emailStatus.available === true ? 'text-green-600' : 
                    emailStatus.available === false ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {emailChecking && "확인 중..."}
                    {!emailChecking && emailStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* 회원 권한 / 포인트 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_level" className="text-xs font-medium">회원 권한</Label>
                <select
                  id="mb_level"
                  value={formData.mb_level}
                  onChange={(e) => handleInputChange('mb_level', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">포인트</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{formData.mb_point}</span>
                  <span className="text-xs text-gray-500">점</span>
                </div>
                {mode === 'create' && (
                  <p className="text-xs text-gray-500">신규 회원은 0점으로 시작됩니다.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. 연락처 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-green-600" />
              연락처 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_hp" className="text-xs font-medium">휴대폰번호</Label>
                <Input
                  id="mb_hp"
                  value={formData.mb_hp}
                  onChange={(e) => handleInputChange('mb_hp', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mb_tel" className="text-xs font-medium">전화번호</Label>
                <Input
                  id="mb_tel"
                  value={formData.mb_tel}
                  onChange={(e) => handleInputChange('mb_tel', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_homepage" className="text-xs font-medium">홈페이지</Label>
                <Input
                  id="mb_homepage"
                  value={formData.mb_homepage}
                  onChange={(e) => handleInputChange('mb_homepage', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. 주소 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-orange-600" />
              주소 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={formData.mb_zip}
                onChange={(e) => handleInputChange('mb_zip', e.target.value)}
                placeholder="우편번호"
                className="text-sm w-32"
                autoComplete="off"
                readOnly
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="text-sm"
                onClick={handleAddressSearch}
              >
                주소 검색
              </Button>
            </div>
            <Input
              value={formData.mb_addr1}
              onChange={(e) => handleInputChange('mb_addr1', e.target.value)}
              placeholder="기본주소"
              autoComplete="off"
              className="text-sm"
              readOnly
            />
            <Input
              value={formData.mb_addr2}
              onChange={(e) => handleInputChange('mb_addr2', e.target.value)}
              placeholder="상세주소"
              autoComplete="off"
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* 4. 인증 및 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-purple-600" />
              인증 및 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_certify" className="text-xs font-medium block">본인확인방법</Label>
                <select
                  id="mb_certify"
                  value={formData.mb_certify}
                  onChange={(e) => handleInputChange('mb_certify', e.target.value)}
                  className="w-1/2 border border-gray-300 rounded-md px-3 py-2 bg-white text-xs block"
                >
                  <option value="simple">간편인증</option>
                  <option value="phone">휴대폰</option>
                  <option value="ipin">아이핀</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">성인인증</Label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="adult" 
                      value="1" 
                      checked={formData.mb_adult === 1}
                      onChange={(e) => handleInputChange('mb_adult', parseInt(e.target.value))}
                      className="mr-2" 
                    />
                    <span className="text-xs">예</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="adult" 
                      value="0" 
                      checked={formData.mb_adult === 0}
                      onChange={(e) => handleInputChange('mb_adult', parseInt(e.target.value))}
                      className="mr-2" 
                    />
                    <span className="text-xs">아니오</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium">메일 수신</Label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="mailling"
                      value="1"
                      checked={formData.mb_mailling === 1}
                      onChange={(e) => handleInputChange('mb_mailling', parseInt(e.target.value))}
                      className="mr-2"
                    />
                    <span className="text-xs">예</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="mailling"
                      value="0"
                      checked={formData.mb_mailling === 0}
                      onChange={(e) => handleInputChange('mb_mailling', parseInt(e.target.value))}
                      className="mr-2"
                    />
                    <span className="text-xs">아니오</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">SMS 수신</Label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sms"
                      value="1"
                      checked={formData.mb_sms === 1}
                      onChange={(e) => handleInputChange('mb_sms', parseInt(e.target.value))}
                      className="mr-2"
                    />
                    <span className="text-xs">예</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sms"
                      value="0"
                      checked={formData.mb_sms === 0}
                      onChange={(e) => handleInputChange('mb_sms', parseInt(e.target.value))}
                      className="mr-2"
                    />
                    <span className="text-xs">아니오</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">정보 공개</Label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="open"
                    value="1"
                    checked={formData.mb_open === 1}
                    onChange={(e) => handleInputChange('mb_open', parseInt(e.target.value))}
                    className="mr-2"
                  />
                  <span className="text-xs">예</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="open"
                    value="0"
                    checked={formData.mb_open === 0}
                    onChange={(e) => handleInputChange('mb_open', parseInt(e.target.value))}
                    className="mr-2"
                  />
                  <span className="text-xs">아니오</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. 파일 업로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-indigo-600" />
              파일 업로드
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium">회원아이콘</Label>
                <p className="text-xs text-gray-500">이미지 크기는 넓이 22픽셀 높이 22픽셀로 해주세요.</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-sm">
                    파일 선택
                  </Button>
                  <span className="text-xs text-gray-500">선택된 파일 없음</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">회원이미지</Label>
                <p className="text-xs text-gray-500">이미지 크기는 넓이 60픽셀 높이 60픽셀로 해주세요.</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-sm">
                    파일 선택
                  </Button>
                  <span className="text-xs text-gray-500">선택된 파일 없음</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. 추가 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-gray-600" />
              추가 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mb_signature" className="text-xs font-medium">서명</Label>
              <Textarea
                id="mb_signature"
                value={formData.mb_signature}
                onChange={(e) => handleInputChange('mb_signature', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_profile" className="text-xs font-medium">자기 소개</Label>
              <Textarea
                id="mb_profile"
                value={formData.mb_profile}
                onChange={(e) => handleInputChange('mb_profile', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_memo" className="text-xs font-medium">메모</Label>
              <Textarea
                id="mb_memo"
                value={formData.mb_memo}
                onChange={(e) => handleInputChange('mb_memo', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* 여분 필드들 */}
            <div className="space-y-4">
              <Label className="text-xs font-medium">여분 필드</Label>
              
              {[1, 3, 5, 7, 9].map((fieldNum) => (
                <div key={fieldNum} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`mb_${fieldNum}`} className="text-xs font-medium">
                      여분 필드 {fieldNum}
                    </Label>
                    <Input
                      id={`mb_${fieldNum}`}
                      value={formData[`mb_${fieldNum}` as keyof MemberFormData] as string}
                      onChange={(e) => handleInputChange(`mb_${fieldNum}` as keyof MemberFormData, e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`mb_${fieldNum + 1}`} className="text-xs font-medium">
                      여분 필드 {fieldNum + 1}
                    </Label>
                    <Input
                      id={`mb_${fieldNum + 1}`}
                      value={formData[`mb_${fieldNum + 1}` as keyof MemberFormData] as string}
                      onChange={(e) => handleInputChange(`mb_${fieldNum + 1}` as keyof MemberFormData, e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 7. 관리 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-red-600" />
              관리 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">본인인증 내역</Label>
              <p className="text-xs text-gray-500">본인인증 내역이 없습니다.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_leave_date" className="text-xs font-medium">탈퇴일자</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="mb_leave_date"
                  value={formData.mb_leave_date}
                  onChange={(e) => handleInputChange('mb_leave_date', e.target.value)}
                  placeholder="YYYY-MM-DD"
                  autoComplete="off"
                  className="text-sm w-32"
                />
                <label className="flex items-center text-xs">
                  <input 
                    type="checkbox" 
                    checked={setTodayLeave}
                    onChange={(e) => handleTodayLeave(e.target.checked)}
                    className="mr-1" 
                  />
                  탈퇴일을 오늘로 지정
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_intercept_date" className="text-xs font-medium">접근차단일자</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="mb_intercept_date"
                  value={formData.mb_intercept_date}
                  onChange={(e) => handleInputChange('mb_intercept_date', e.target.value)}
                  placeholder="YYYY-MM-DD"
                  autoComplete="off"
                  className="text-sm w-32"
                />
                <label className="flex items-center text-xs">
                  <input 
                    type="checkbox" 
                    checked={setTodayIntercept}
                    onChange={(e) => handleTodayIntercept(e.target.checked)}
                    className="mr-1" 
                  />
                  접근차단일을 오늘로 지정
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 하단 액션 버튼 */}
        <div className="flex justify-center gap-4 pt-6">
          <Button variant="outline" onClick={onCancel} size="lg" className="text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              loading || 
              !validateId(formData.mb_id).valid || 
              (mode === 'create' && (!idStatus.checked || !idStatus.available)) ||
              (formData.mb_nick.trim() && (!nickStatus.checked || !nickStatus.available)) ||
              !validateEmail(formData.mb_email).valid ||
              !emailStatus.checked ||
              !emailStatus.available
            }
            className="bg-red-600 hover:bg-red-700 text-sm"
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "저장 중..." : (mode === 'create' ? '회원 추가' : '회원 수정')}
          </Button>
        </div>
      </div>
    </>
  )
} 