"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Plus, 
  User,
  Check,
  X,
  Loader2,
} from "lucide-react"

import { MemberListItem, MemberStats, MemberSearchFilter } from "@/lib/types/member"

function MembersContent() {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // URL 파라미터에서 초기값 가져오기
  const [activeMenu, setActiveMenu] = useState("members")
  const [selectedFilter, setSelectedFilter] = useState<MemberSearchFilter['filter']>(
    (searchParams.get("filter") as MemberSearchFilter['filter']) || "all"
  )
  const [searchType, setSearchType] = useState<MemberSearchFilter['searchType']>(
    (searchParams.get("searchType") as MemberSearchFilter['searchType']) || "userId"
  )
  const [searchValue, setSearchValue] = useState(searchParams.get("searchValue") || "")
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [stats, setStats] = useState<MemberStats>({
    totalMembers: 0,
    blockedMembers: 0,
    withdrawnMembers: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1"))
  const [totalPages, setTotalPages] = useState(1)

  // 성공 메시지 상태 추가
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  // URL 업데이트 함수
  const updateURL = (params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "") {
        newSearchParams.set(key, value)
      } else {
        newSearchParams.delete(key)
      }
    })
    
    const newURL = `${window.location.pathname}?${newSearchParams.toString()}`
    router.push(newURL, { scroll: false })
  }

  // 회원 목록 조회
  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        searchType,
        searchValue,
        filter: selectedFilter
      })

      const response = await fetch(`/api/admin/members?${params}`)
      const data = await response.json()

      if (data.success) {
        setMembers(data.members.map((member: MemberListItem) => ({ ...member, selected: false })))
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('회원 목록 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, selectedFilter, searchType, searchValue])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    // URL에서 성공 파라미터 확인
    if (searchParams.get('success') === 'true') {
      setShowSuccessMessage(true)
      // 3초 후 메시지 숨기기
      setTimeout(() => setShowSuccessMessage(false), 3000)
    }
  }, [searchParams])

  const filters = [
    { id: "all", label: t('membersFilterAll'), count: `${stats.totalMembers}` },
    { id: "total", label: `${t('membersFilterTotal')} ${stats.totalMembers}`, count: "" },
    { id: "blocked", label: `${t('membersFilterBlocked')} ${stats.blockedMembers}`, count: "" },
    { id: "withdrawn", label: `${t('membersFilterWithdrawn')} ${stats.withdrawnMembers}`, count: "" }
  ]

  const handleSelectAll = (checked: boolean) => {
    setMembers(members.map(member => ({ ...member, selected: checked })))
  }

  const handleSelectMember = (mb_id: string, checked: boolean) => {
    setMembers(members.map(member => 
      member.mb_id === mb_id ? { ...member, selected: checked } : member
    ))
  }

  const handleBulkEdit = () => {
    const selectedMembers = members.filter(member => member.selected)
    console.log("선택된 회원 수정:", selectedMembers)
  }

  const handleBulkDelete = async () => {
    const selectedMembers = members.filter(member => member.selected)
    if (selectedMembers.length === 0) return

    if (confirm(t('bulkDeleteConfirm', { count: selectedMembers.length }))) {
      try {
        for (const member of selectedMembers) {
          await fetch(`/api/admin/members?mb_id=${member.mb_id}`, {
            method: 'DELETE'
          })
        }
        fetchMembers()
      } catch (error) {
        console.error('회원 삭제 실패:', error)
      }
    }
  }

  // 회원 추가 핸들러 수정
  const handleAddMember = () => {
    router.push('/admin/members/new')
  }

  // 회원 수정 핸들러 수정
  const handleEditMember = (mb_id: string) => {
    router.push(`/admin/members/${mb_id}/edit`)
  }

  // 모달 관련 함수들 제거
  // handleSaveMember, handleSaveMemberEdit 함수 제거

  const handleGroupMember = (mb_id: string) => {
    console.log("회원 그룹 관리:", mb_id)
  }

  // 필터 변경 핸들러
  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter as MemberSearchFilter['filter'])
    setCurrentPage(1)
    updateURL({ filter, page: "1" })
  }

  // 검색 타입 변경 핸들러
  const handleSearchTypeChange = (type: string) => {
    setSearchType(type as MemberSearchFilter['searchType'])
    updateURL({ searchType: type })
  }

  // 검색 실행 핸들러
  const handleSearch = () => {
    setCurrentPage(1)
    updateURL({ 
      searchValue, 
      searchType, 
      page: "1" 
    })
  }

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    updateURL({ page: page.toString() })
  }

  const getStatusText = (member: MemberListItem) => {
    if (member.mb_leave_date) return t('statusWithdrawn')
    if (member.mb_intercept_date) return t('statusBlocked')
    return t('statusNormal')
  }

  const getStatusColor = (member: MemberListItem) => {
    if (member.mb_leave_date) return "bg-gray-500"
    if (member.mb_intercept_date) return "bg-red-500"
    return "bg-green-500"
  }

  const getCertifyText = (certify: string) => {
    switch (certify) {
      case 'hp': return t('certifyHp')
      case 'ipin': return t('certifyIpin')
      case 'simple': return t('certifySimple')
      default: return t('certifyNone')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '0000-00-00 00:00:00') return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-4">
          <div className="bg-white rounded-lg shadow">
            {/* 성공 메시지 */}
            {showSuccessMessage && (
              <div className="p-4 bg-green-50 border-b border-green-200">
                <p className="text-sm text-green-800">
                  {t('operationSuccess')}
                </p>
              </div>
            )}
            
            {/* 헤더 */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">{t('membersTitle')}</h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkEdit}
                  disabled={!members.some(m => m.selected)}
                >
                  {t('membersSelectEdit')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={!members.some(m => m.selected)}
                >
                  {t('membersSelectDelete')}
                </Button>
                <Button size="sm" onClick={handleAddMember} className="bg-pink-500 hover:bg-pink-600">
                  <Plus className="w-3 h-3 mr-1" />
                  {t('membersAddButton')}
                </Button>
              </div>
            </div>

            {/* 필터 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex gap-2 mb-3">
                {filters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={selectedFilter === filter.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange(filter.id)}
                    className={selectedFilter === filter.id ? "bg-blue-600" : ""}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              {/* 검색 */}
              <div className="flex gap-2">
                <select
                  value={searchType}
                  onChange={(e) => handleSearchTypeChange(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="userId">{t('searchById')}</option>
                  <option value="name">{t('searchByName')}</option>
                  <option value="nickname">{t('searchByNick')}</option>
                  <option value="email">{t('searchByEmail')}</option>
                </select>
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="flex-1 text-xs"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch}>
                  <Search className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="p-3 bg-blue-50 border-b border-blue-200">
              <p className="text-xs text-blue-800">
                {t('membersNotice')}
              </p>
            </div>

            {/* 회원 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={members.length > 0 && members.every(m => m.selected)}
                      />
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colId')}</div>
                      <div className="text-xs text-gray-500">{t('colNameNick')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">{t('colIdVerify')}</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colMailVerify')}</div>
                      <div className="text-xs text-gray-500">{t('colSmsReceive')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colInfoOpen')}</div>
                      <div className="text-xs text-gray-500">{t('colAdultCertify')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colMailReceive')}</div>
                      <div className="text-xs text-gray-500">{t('colAccessBlock')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('status')}</div>
                      <div className="text-xs text-gray-500">{t('colStatusRole')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colPhone')}</div>
                      <div className="text-xs text-gray-500">{t('colTel')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colLastLogin')}</div>
                      <div className="text-xs text-gray-500">{t('colJoinDate')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>{t('colAccessGroup')}</div>
                      <div className="text-xs text-gray-500">{t('colPoints')}</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">{t('colManage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-xs text-gray-500">
                        {t('loadingText')}
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-xs text-gray-500">
                        {t('noMembers')}
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.mb_id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={member.selected || false}
                            onChange={(e) => handleSelectMember(member.mb_id, e.target.checked)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-xs">{member.mb_id}</div>
                          <div className="text-xs text-gray-600">
                            {member.mb_name || '-'} / {member.mb_nick || '-'}
                            {member.mb_nick && <User className="inline w-2 h-2 ml-1" />}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{getCertifyText(member.mb_certify)}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_email_certify && member.mb_email_certify !== '0000-00-00 00:00:00' ? (
                              <span className="text-red-500">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_sms ? t('receive') : t('reject')}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_open ? t('openPublic') : t('closedPublic')}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_adult ? (
                              <Check className="inline w-2 h-2 text-blue-500" />
                            ) : (
                              <X className="inline w-2 h-2 text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_mailling ? t('receive') : t('reject')}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_intercept_date ? t('statusBlocked') : t('statusNormal')}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            <Badge className={`${getStatusColor(member)} text-white text-xs`}>
                              {getStatusText(member)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_level}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{member.mb_hp || '-'}</div>
                          <div className="text-xs text-gray-600">{member.mb_tel || '-'}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{formatDate(member.mb_today_login)}</div>
                          <div className="text-xs text-gray-600">{formatDate(member.mb_datetime)}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">-</div>
                          <div className="text-xs text-gray-600">{member.mb_point}</div>
                        </td>
                        <td className="p-2">
                          {member.mb_level >= 10 ? (
                            <Button variant="outline" size="sm" onClick={() => handleGroupMember(member.mb_id)}>
                              {t('groupBtn')}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => handleEditMember(member.mb_id)}>
                              {t('editBtn')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center p-3 border-t border-gray-200">
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    {tc('previous')}
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {tc('next')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MembersContent />
    </Suspense>
  );
}