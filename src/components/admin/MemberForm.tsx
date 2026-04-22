"use client"

import { useState, useEffect, useCallback } from "react"
import Script from "next/script"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Mail, MapPin, Shield, Settings, Lock, FileText, Calendar } from "lucide-react"
import { MemberFormData, MemberFormProps, Member } from "@/lib/types/member"
import { Textarea } from "@/components/ui/textarea"

// Type declarations for the Daum postcode API
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
  const t = useTranslations('admin')
  const [loading, setLoading] = useState(false)
  const [idChecking, setIdChecking] = useState(false)
  const [nickChecking, setNickChecking] = useState(false)
  const [emailChecking, setEmailChecking] = useState(false)
  
  // Duplicate-check states
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

  // Load existing data in edit mode
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

            // Skip the user-id uniqueness check in edit mode and mark it as available
            setIdStatus({
              available: true,
              message: t('existingId'),
              checked: true
            })
          } else {
            alert(data.error || t('memberLoadError'))
          }
        } catch (error) {
          console.error('failed to load member:', error)
          alert(t('networkError'))
        } finally {
          setLoading(false)
        }
      }

      fetchMember()
    }
  }, [mode, memberId, t])

  // Validation helpers
  const validateId = (id: string) => {
    if (!id.trim()) {
      return { valid: false, message: t('validateIdRequired') }
    }
    if (id.length < 3) {
      return { valid: false, message: t('validateIdMinLength') }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      return { valid: false, message: t('validateIdFormat') }
    }
    return { valid: true, message: "" }
  }

  const validateNick = (nick: string) => {
    if (!nick.trim()) {
      return { valid: false, message: t('validateNickRequired') }
    }
    if (nick.length < 2) {
      return { valid: false, message: t('validateNickMinLength') }
    }
    if (nick.length > 20) {
      return { valid: false, message: t('validateNickMaxLength') }
    }
    return { valid: true, message: "" }
  }

  const validateEmail = (email: string) => {
    if (!email.trim()) {
      return { valid: false, message: t('validateEmailRequired') }
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return { valid: false, message: t('validateEmailFormat') }
    }
    return { valid: true, message: "" }
  }

  // Debounced uniqueness checks
  const debouncedCheckId = useCallback(
    (async (id: string) => {
      // Skip user-id uniqueness check in edit mode (ID is immutable)
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
            message: data.error || t('duplicateCheckError'),
            checked: false
          })
        }
      } catch (error) {
        console.error('user-id uniqueness check failed:', error)
        setIdStatus({
          available: false,
          message: t('networkError'),
          checked: false
        })
      } finally {
        setIdChecking(false)
      }
    }),
    [mode, t]
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
            // In edit mode, exclude the current member
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
            message: data.error || t('duplicateCheckError'),
            checked: false
          })
        }
      } catch (error) {
        console.error('nickname uniqueness check failed:', error)
        setNickStatus({
          available: false,
          message: t('networkError'),
          checked: false
        })
      } finally {
        setNickChecking(false)
      }
    }),
    [mode, memberId, t]
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
            // In edit mode, exclude the current member
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
            message: data.error || t('duplicateCheckError'),
            checked: false
          })
        }
      } catch (error) {
        console.error('email uniqueness check failed:', error)
        setEmailStatus({
          available: false,
          message: t('networkError'),
          checked: false
        })
      } finally {
        setEmailChecking(false)
      }
    }),
    [mode, memberId, t]
  )

  // Auto-running uniqueness-check effects
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

  // Helpers that set dates to today
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

  // Address search helper
  const handleAddressSearch = () => {
    if (!window.daum) {
      alert(t('addressServiceLoading'))
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

    // Basic validation
    const idValidation = validateId(formData.mb_id)
    if (!idValidation.valid) {
      alert(idValidation.message)
      return
    }

    if (mode === 'create' && (!idStatus.checked || !idStatus.available)) {
      alert(t('validateIdNotAvailable'))
      return
    }

    // Password is required only in create mode
    if (mode === 'create' && !formData.mb_password) {
      alert(t('validatePasswordRequired'))
      document.getElementById('mb_password')?.focus()
      return
    }

    if (!formData.mb_name.trim()) {
      alert(t('validateNameRequired'))
      document.getElementById('mb_name')?.focus()
      return
    }

    if (!formData.mb_nick.trim()) {
      alert(t('validateNickRequired'))
      document.getElementById('mb_nick')?.focus()
      return
    }

    if (!formData.mb_email.trim()) {
      alert(t('validateEmailRequired'))
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
        alert(t('validateNickNotAvailable'))
        return
      }
    }

    const emailValidation = validateEmail(formData.mb_email)
    if (!emailValidation.valid) {
      alert(emailValidation.message)
      return
    }

    if (!emailStatus.checked || !emailStatus.available) {
      alert(t('validateEmailNotAvailable'))
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
        alert(t('memberSaveSuccess', { action: mode === 'create' ? t('actionAdd') : t('actionEdit') }))
        onSuccess()
      } else {
        alert(data.error || t('memberSaveFailed', { action: mode === 'create' ? t('actionAdd') : t('actionEdit') }))
      }
    } catch (error) {
      console.error(`member ${mode} failed:`, error)
      alert(t('networkError'))
    } finally {
      setLoading(false)
    }
  }

  // Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Allow Shift+Enter in a textarea to insert a newline
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
      {/* Load the Kakao postcode API script */}
      <Script
        src="//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
        onError={(e) => {
          console.error('Kakao Postcode API load failed:', e)
        }}
      />
      
      <div className="space-y-6" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onCancel} className="text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('listBtn')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'create' ? t('memberAdd') : t('memberEdit')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {mode === 'create' ? t('memberAddDesc') : t('memberEditDesc')}
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
            {loading ? t('savingText') : (mode === 'create' ? t('memberAdd') : t('memberEdit'))}
          </Button>
        </div>

        {/* 1. Basic account info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-blue-600" />
              {t('basicAccountInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User ID / password */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_id" className="text-xs font-medium">{t('idLabel')}</Label>
                <Input
                  id="mb_id"
                  maxLength={20}
                  value={formData.mb_id}
                  onChange={(e) => handleInputChange('mb_id', e.target.value)}
                  autoComplete="off"
                  className={`text-sm ${mode === 'edit' ? 'bg-gray-100' : ''}`}
                  required
                  disabled={mode === 'edit'} // User ID cannot be changed in edit mode
                />
                {formData.mb_id && (
                  <div className={`text-xs ${
                    idStatus.available === true ? 'text-green-600' : 
                    idStatus.available === false ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {idChecking && t('checking')}
                    {!idChecking && idStatus.message}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mb_password" className="text-xs font-medium">
                  {t('passwordLabel')} {mode === 'create' ? '*' : t('passwordCreateRequired')}
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

            {/* Name / nickname */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_name" className="text-xs font-medium">{t('realNameLabel')}</Label>
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
                <Label htmlFor="mb_nick" className="text-xs font-medium">{t('nickLabel')}</Label>
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
                    {nickChecking && t('checking')}
                    {!nickChecking && nickStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_email" className="text-xs font-medium">{t('emailLabel')} *</Label>
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
                    {emailChecking && t('checking')}
                    {!emailChecking && emailStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Role / points */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_level" className="text-xs font-medium">{t('memberRole')}</Label>
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
                <Label className="text-xs font-medium">{t('pointsLabel')}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{formData.mb_point}</span>
                  <span className="text-xs text-gray-500">{t('pointsUnit')}</span>
                </div>
                {mode === 'create' && (
                  <p className="text-xs text-gray-500">{t('newMemberPoints')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-green-600" />
              {t('contactInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_hp" className="text-xs font-medium">{t('mobilePhone')}</Label>
                <Input
                  id="mb_hp"
                  value={formData.mb_hp}
                  onChange={(e) => handleInputChange('mb_hp', e.target.value)}
                  autoComplete="off"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mb_tel" className="text-xs font-medium">{t('phoneNum')}</Label>
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
                <Label htmlFor="mb_homepage" className="text-xs font-medium">{t('homepage')}</Label>
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

        {/* 3. Address info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-orange-600" />
              {t('addressInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={formData.mb_zip}
                onChange={(e) => handleInputChange('mb_zip', e.target.value)}
                placeholder={t('zipCode')}
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
                {t('addressSearch')}
              </Button>
            </div>
            <Input
              value={formData.mb_addr1}
              onChange={(e) => handleInputChange('mb_addr1', e.target.value)}
              placeholder={t('basicAddress')}
              autoComplete="off"
              className="text-sm"
              readOnly
            />
            <Input
              value={formData.mb_addr2}
              onChange={(e) => handleInputChange('mb_addr2', e.target.value)}
              placeholder={t('detailAddress')}
              autoComplete="off"
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* 4. Verification & settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-purple-600" />
              {t('authSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mb_certify" className="text-xs font-medium block">{t('idCertifyMethod')}</Label>
                <select
                  id="mb_certify"
                  value={formData.mb_certify}
                  onChange={(e) => handleInputChange('mb_certify', e.target.value)}
                  className="w-1/2 border border-gray-300 rounded-md px-3 py-2 bg-white text-xs block"
                >
                  <option value="simple">{t('certifySimple')}</option>
                  <option value="phone">{t('certifyHp')}</option>
                  <option value="ipin">{t('certifyIpin')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('adultCertify')}</Label>
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
                    <span className="text-xs">{t('yes')}</span>
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
                    <span className="text-xs">{t('no')}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('mailReceive')}</Label>
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
                    <span className="text-xs">{t('yes')}</span>
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
                    <span className="text-xs">{t('no')}</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('smsReceive')}</Label>
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
                    <span className="text-xs">{t('yes')}</span>
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
                    <span className="text-xs">{t('no')}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('infoOpen')}</Label>
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
                  <span className="text-xs">{t('yes')}</span>
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
                  <span className="text-xs">{t('no')}</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. File uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-indigo-600" />
              {t('fileUpload')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('memberIcon')}</Label>
                <p className="text-xs text-gray-500">{t('memberIconHint')}</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-sm">
                    {t('fileSelect')}
                  </Button>
                  <span className="text-xs text-gray-500">{t('noFileSelected')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('memberImage')}</Label>
                <p className="text-xs text-gray-500">{t('memberImageHint')}</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-sm">
                    {t('fileSelect')}
                  </Button>
                  <span className="text-xs text-gray-500">{t('noFileSelected')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Additional info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-gray-600" />
              {t('additionalInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mb_signature" className="text-xs font-medium">{t('signature')}</Label>
              <Textarea
                id="mb_signature"
                value={formData.mb_signature}
                onChange={(e) => handleInputChange('mb_signature', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_profile" className="text-xs font-medium">{t('selfIntro')}</Label>
              <Textarea
                id="mb_profile"
                value={formData.mb_profile}
                onChange={(e) => handleInputChange('mb_profile', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_memo" className="text-xs font-medium">{t('memo')}</Label>
              <Textarea
                id="mb_memo"
                value={formData.mb_memo}
                onChange={(e) => handleInputChange('mb_memo', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Extra fields */}
            <div className="space-y-4">
              <Label className="text-xs font-medium">{t('extraFields')}</Label>
              
              {[1, 3, 5, 7, 9].map((fieldNum) => (
                <div key={fieldNum} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`mb_${fieldNum}`} className="text-xs font-medium">
                      {t('extraField', { n: fieldNum })}
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
                      {t('extraField', { n: fieldNum + 1 })}
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

        {/* 7. Admin info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-red-600" />
              {t('manageInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('identityVerifyHistory')}</Label>
              <p className="text-xs text-gray-500">{t('noIdentityVerify')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_leave_date" className="text-xs font-medium">{t('leaveDate')}</Label>
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
                  {t('setLeaveToday')}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mb_intercept_date" className="text-xs font-medium">{t('interceptDate')}</Label>
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
                  {t('setInterceptToday')}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom action buttons */}
        <div className="flex justify-center gap-4 pt-6">
          <Button variant="outline" onClick={onCancel} size="lg" className="text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('listBackBtn')}
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
            {loading ? t('savingText') : (mode === 'create' ? t('memberAdd') : t('memberEdit'))}
          </Button>
        </div>
      </div>
    </>
  )
} 