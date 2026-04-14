"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react"

interface LoginLog {
  id: string
  email: string
  ip: string
  success: boolean
  reason: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function LoginLogsContent() {
  const t = useTranslations('admin')
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPage = parseInt(searchParams.get("page") || "1")
  const initialEmail = searchParams.get("email") || ""
  const initialIp = searchParams.get("ip") || ""
  const initialSuccess = searchParams.get("success") || ""

  const [logs, setLogs] = useState<LoginLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [emailSearch, setEmailSearch] = useState(initialEmail)
  const [ipSearch, setIpSearch] = useState(initialIp)
  const [successFilter, setSuccessFilter] = useState(initialSuccess)

  const updateURL = useCallback(
    (email: string, ip: string, success: string, page: number) => {
      const params = new URLSearchParams()
      if (email) params.set("email", email)
      if (ip) params.set("ip", ip)
      if (success) params.set("success", success)
      if (page > 1) params.set("page", String(page))
      const query = params.toString()
      router.replace(`/admin/login-logs${query ? `?${query}` : ""}`)
    },
    [router]
  )

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      })
      if (emailSearch) params.set("email", emailSearch)
      if (ipSearch) params.set("ip", ipSearch)
      if (successFilter) params.set("success", successFilter)

      const response = await fetch(`/api/admin/login-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("로그인 기록 조회 실패:", error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, emailSearch, ipSearch, successFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSearch = () => {
    setCurrentPage(1)
    updateURL(emailSearch, ipSearch, successFilter, 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    const hh = String(date.getHours()).padStart(2, "0")
    const mi = String(date.getMinutes()).padStart(2, "0")
    return `${yy}-${mm}-${dd} ${hh}:${mi}`
  }

  const totalPages = pagination.totalPages

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="login-logs" />

        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="h-6 w-6" />
                {t('loginLogsTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('loginLogsDesc')}
              </p>
            </div>
          </div>

          {/* Table Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                {/* Email Search */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('emailSearchPlaceholder')}
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                </div>
                {/* IP Search */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('ipSearchPlaceholder')}
                    value={ipSearch}
                    onChange={(e) => setIpSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                </div>
                {/* Success Filter */}
                <select
                  value={successFilter}
                  onChange={(e) => {
                    setSuccessFilter(e.target.value)
                    setCurrentPage(1)
                    updateURL(emailSearch, ipSearch, e.target.value, 1)
                  }}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{t('all')}</option>
                  <option value="true">{t('success')}</option>
                  <option value="false">{t('failed')}</option>
                </select>
                {/* Search Button */}
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <Search className="mr-2 h-4 w-4" />
                  {t('searchBtn')}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-y bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('logStatus')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('emailLabel')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('logIp')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('logReason')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('logDate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="h-32 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="h-32 text-center text-muted-foreground"
                        >
                          {t('noLoginLogs')}
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <td className="p-4 align-middle">
                            {log.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </td>
                          <td className="p-4 align-middle text-sm">
                            {log.email}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {log.ip}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {log.reason || "-"}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {t('totalOfLogs', { total: pagination.total, from: (currentPage - 1) * pagination.limit + 1, to: Math.min(currentPage * pagination.limit, pagination.total) })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const newPage = Math.max(1, currentPage - 1)
                        setCurrentPage(newPage)
                        updateURL(emailSearch, ipSearch, successFilter, newPage)
                      }}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from(
                      { length: Math.min(5, totalPages) },
                      (_, i) => {
                        let page: number
                        if (totalPages <= 5) {
                          page = i + 1
                        } else if (currentPage <= 3) {
                          page = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i
                        } else {
                          page = currentPage - 2 + i
                        }
                        return (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setCurrentPage(page)
                              updateURL(
                                emailSearch,
                                ipSearch,
                                successFilter,
                                page
                              )
                            }}
                          >
                            {page}
                          </Button>
                        )
                      }
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const newPage = Math.min(totalPages, currentPage + 1)
                        setCurrentPage(newPage)
                        updateURL(emailSearch, ipSearch, successFilter, newPage)
                      }}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default function LoginLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginLogsContent />
    </Suspense>
  )
}
