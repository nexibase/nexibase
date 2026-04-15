"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, Users, Download, Trash2 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface TrendData {
  date: string
  count: number
}

function UserTrendsContent() {
  const t = useTranslations('admin')
  const [trends, setTrends] = useState<TrendData[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [periodUsers, setPeriodUsers] = useState(0)
  const [period, setPeriod] = useState("30")
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/user-trends?period=${period}`)
      const data = await res.json()
      if (data.success) {
        setTrends(data.trends)
        setTotalUsers(data.totalUsers)
        setPeriodUsers(data.periodUsers)
      }
    } catch (error) {
      console.error("failed to fetch signup trend:", error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  const handleSeed = async () => {
    if (!confirm(t('seedConfirmCreate'))) return
    setSeeding(true)
    try {
      const res = await fetch("/api/admin/users/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1000, months: 3 }),
      })
      const data = await res.json()
      alert(data.message)
      fetchTrends()
    } catch {
      alert(t('seedCreateFailed'))
    } finally {
      setSeeding(false)
    }
  }

  const handleDeleteSeed = async () => {
    if (!confirm(t('seedConfirmDelete'))) return
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/users/seed", { method: "DELETE" })
      const data = await res.json()
      alert(data.message)
      fetchTrends()
    } catch {
      alert(t('seedDeleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (period === "7") {
      return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
    if (period === "90") {
      return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
  }

  // Too many labels on the 90-day view, so space them out
  const tickInterval = period === "90" ? 6 : period === "30" ? 2 : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="users" />

        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                {t('userTrendsTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('userTrendsDesc')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
                {t('seedCreate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSeed}
                disabled={deleting}
                className="text-destructive hover:text-destructive"
              >
                {deleting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
                {t('seedDelete')}
              </Button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('totalMembers')}</p>
                    <p className="text-2xl font-bold">{totalUsers.toLocaleString()}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('periodNewUsers')}</p>
                    <p className="text-2xl font-bold">{periodUsers.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('dailyAvg')}</p>
                    <p className="text-2xl font-bold">
                      {trends.length > 0 ? (periodUsers / trends.length).toFixed(1) : 0}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('dailyNewUsers')}</CardTitle>
              <div className="flex items-center gap-1">
                {["7", "30", "90"].map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriod(p)}
                  >
                    {t('daysPeriod', { days: p })}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends.map(t => ({ ...t, date: formatDate(t.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis
                      dataKey="date"
                      fontSize={12}
                      tickLine={false}
                      interval={tickInterval}
                      angle={period === "90" ? -45 : 0}
                      textAnchor={period === "90" ? "end" : "middle"}
                      height={period === "90" ? 60 : 30}
                    />
                    <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      labelStyle={{ fontWeight: 600 }}
                      formatter={(value) => [`${value}`, t('subscribers')]}
                    />
                    <Line
                      type="linear"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: period === "90" ? 1 : 3, fill: "#3b82f6" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default function UserTrendsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <UserTrendsContent />
    </Suspense>
  )
}
