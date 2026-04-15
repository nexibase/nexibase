"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Edit, Trash2, Plus } from "lucide-react"

export function UsersContent() {
  const t = useTranslations('admin')
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">{t('members')}</h2>
          <p className="text-muted-foreground">{t('usersDescription')}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('newUser')}
        </Button>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('userSearchPlaceholder')} className="pl-10" />
            </div>
            <Button variant="outline">{t('filter')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Member list */}
      <Card>
        <CardHeader>
          <CardTitle>{t('members')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">{t('searchByName')}</th>
                  <th className="text-left p-2">{t('emailLabel')}</th>
                  <th className="text-left p-2">{t('createdAt')}</th>
                  <th className="text-left p-2">{t('status')}</th>
                  <th className="text-left p-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="p-2">{i}</td>
                    <td className="p-2">User {i}</td>
                    <td className="p-2">user{i}@example.com</td>
                    <td className="p-2">2024-01-{String(i).padStart(2, '0')}</td>
                    <td className="p-2">
                      <Badge variant={i % 2 === 0 ? "default" : "secondary"}>
                        {i % 2 === 0 ? t('statusActive') : t('statusInactive')}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
