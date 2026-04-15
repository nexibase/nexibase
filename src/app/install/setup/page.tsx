"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { localeRegistry } from '@/lib/install/_generated-registry'
import Link from 'next/link'
import pkg from '../../../../package.json'

const LABELS: Record<string, Record<string, string>> = {
  en: {
    title: 'Admin Account & Site Info',
    back: '← Back to language selection',
    adminEmail: 'Admin Email',
    adminPassword: 'Password',
    adminPasswordConfirm: 'Confirm Password',
    adminNickname: 'Admin Nickname',
    siteName: 'Site Name',
    siteDescription: 'Site Description (optional)',
    submit: 'Install',
    submitting: 'Installing...',
    unknownError: 'Installation failed. Please check your input and try again.',
  },
  ko: {
    title: '관리자 계정 및 사이트 정보',
    back: '← 언어 선택으로 돌아가기',
    adminEmail: '관리자 이메일',
    adminPassword: '비밀번호',
    adminPasswordConfirm: '비밀번호 확인',
    adminNickname: '관리자 닉네임',
    siteName: '사이트 이름',
    siteDescription: '사이트 설명 (선택)',
    submit: '설치',
    submitting: '설치 중...',
    unknownError: '설치에 실패했습니다. 입력값을 확인하고 다시 시도해주세요.',
  },
}

function SetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = searchParams.get('locale') || 'en'

  // If the locale is not in the registry, fall back to Step 1
  useEffect(() => {
    if (!(locale in localeRegistry)) {
      router.replace('/install')
    }
  }, [locale, router])

  const t = LABELS[locale] ?? LABELS.en

  const [form, setForm] = useState({
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminNickname: '',
    siteName: '',
    siteDescription: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, ...form }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ _: data.error || t.unknownError })
        }
        setSubmitting(false)
        return
      }

      // Success → full page reload so middleware picks up the new state
      window.location.href = data.redirectTo || '/admin/login'
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : t.unknownError })
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm p-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Nexibase</h1>
        <p className="text-xs text-slate-500">v{pkg.version}</p>
      </div>

      <div>
        <Link
          href="/install"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {t.back}
        </Link>
        <h2 className="mt-2 text-lg font-semibold">{t.title}</h2>
      </div>

      {errors._ && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
          {errors._}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t.adminEmail}</label>
          <input
            type="email"
            required
            value={form.adminEmail}
            onChange={e => handleChange('adminEmail', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminEmail && <p className="mt-1 text-xs text-red-600">{errors.adminEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminPassword}</label>
          <input
            type="password"
            required
            value={form.adminPassword}
            onChange={e => handleChange('adminPassword', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminPassword && <p className="mt-1 text-xs text-red-600">{errors.adminPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminPasswordConfirm}</label>
          <input
            type="password"
            required
            value={form.adminPasswordConfirm}
            onChange={e => handleChange('adminPasswordConfirm', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminPasswordConfirm && <p className="mt-1 text-xs text-red-600">{errors.adminPasswordConfirm}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminNickname}</label>
          <input
            type="text"
            required
            value={form.adminNickname}
            onChange={e => handleChange('adminNickname', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminNickname && <p className="mt-1 text-xs text-red-600">{errors.adminNickname}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.siteName}</label>
          <input
            type="text"
            required
            value={form.siteName}
            onChange={e => handleChange('siteName', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.siteName && <p className="mt-1 text-xs text-red-600">{errors.siteName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.siteDescription}</label>
          <textarea
            value={form.siteDescription}
            onChange={e => handleChange('siteDescription', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
          />
          {errors.siteDescription && <p className="mt-1 text-xs text-red-600">{errors.siteDescription}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  )
}

export default function InstallStep2() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <SetupForm />
    </Suspense>
  )
}
