import React, { useState, useEffect, useCallback } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { subjectApi, Subject } from '../api/subjects'
import SubjectNav from '../components/SubjectNav'
import { colors } from '../styles'

export interface SubjectContextValue {
  subject: Subject
  id: string
  statsLoading: boolean
  refreshSubject: () => Promise<void>
}

export const SubjectContext = React.createContext<SubjectContextValue | null>(null)

const SubjectLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const refreshSubject = useCallback(async () => {
    if (!id) return
    setStatsLoading(true)
    try {
      const res = await subjectApi.get(id)
      setSubject(res)
    } catch (_) {}
    setStatsLoading(false)
  }, [id])

  useEffect(() => {
    if (!id) return
    refreshSubject()
  }, [id])

  if (!subject || !id) {
    return (
      <div>
        <SubjectNav subjectId={id || ''} subjectName="加载中..." />
        <div style={{ textAlign: 'center', padding: 60, color: colors.textSecondary }}>加载中...</div>
      </div>
    )
  }

  return (
    <SubjectContext.Provider value={{ subject, id, statsLoading, refreshSubject }}>
      <SubjectNav subjectId={id} subjectName={subject.name} />
      <Outlet />
    </SubjectContext.Provider>
  )
}

export default SubjectLayout
