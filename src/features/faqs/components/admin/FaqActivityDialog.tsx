"use client"

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { FaqActivityAudience, FaqActivityDetails, FaqActivityKind } from '../../lib/activity-types'

export function FaqActivityDialog({ faq, kind, onClose }: { faq: { id: number; question: string }; kind: FaqActivityKind; onClose: () => void }) {
  const t = useTranslations('faqs.admin.activity')
  const locale = useLocale()
  const [audience, setAudience] = useState<FaqActivityAudience>('all')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<FaqActivityDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch(`/api/admin/faqs/${faq.id}/activity?kind=${kind}&audience=${audience}&page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Activity unavailable')
        const result: FaqActivityDetails = await response.json()
        if (!controller.signal.aborted) setData(result)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [faq.id, kind, audience, page, refresh])
  const pages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t(`${kind}Title`)}</DialogTitle><DialogDescription>{faq.question}</DialogDescription></DialogHeader>
        {data && <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm"><span>{t('total')}: <strong>{data.totals.aggregate}</strong></span><span>{t('recorded')}: <strong>{data.totals.recorded}</strong></span><span>{t('user')}: {data.totals.user}</span><span>{t('guest')}: {data.totals.guest}</span></div>}
        {data && data.totals.historical > 0 && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{t('historical', { count: data.totals.historical })}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={audience} onValueChange={value => { setAudience(value as FaqActivityAudience); setPage(1) }}><TabsList><TabsTrigger value="all">{t('all')}</TabsTrigger><TabsTrigger value="user">{t('user')}</TabsTrigger><TabsTrigger value="guest">{t('guest')}</TabsTrigger></TabsList></Tabs>
          <Button variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>{t('refresh')}</Button>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</p> : error ? <p role="alert" className="py-8 text-center text-sm text-destructive">{t('error')}</p> : data && data.records.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>{t('type')}</TableHead><TableHead>{t('actor')}</TableHead><TableHead>{t('time')}</TableHead></TableRow></TableHeader>
            <TableBody>{data.records.map(row => <TableRow key={row.id}>
              <TableCell><Badge variant={row.actor.type === 'user' ? 'default' : 'secondary'}>{t(row.actor.type)}</Badge></TableCell>
              <TableCell>{row.actor.type === 'user' ? <span>{row.actor.user.nickname || t('withdrawn')} <span className="text-xs text-muted-foreground">#{row.actor.user.id}</span></span> : <span className="font-mono text-xs">{row.actor.label}</span>}</TableCell>
              <TableCell className="text-xs">{new Date(row.occurredAt).toLocaleString(locale)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>}
        <div className="flex items-center justify-between gap-2 text-sm"><span>{t('page', { page, pages })}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>{t('previous')}</Button><Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>{t('next')}</Button></div></div>
      </DialogContent>
    </Dialog>
  )
}
