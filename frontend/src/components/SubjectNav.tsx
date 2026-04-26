import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { colors, radius, transition } from '../styles'

interface SubjectNavProps {
  subjectId: string
  subjectName: string
}

const tabs = [
  { path: '', label: '概览', icon: '📊' },
  { path: '/chat', label: '对话', icon: '💬' },
  { path: '/knowledge', label: '知识结构', icon: '📚' },
  { path: '/quiz', label: '习题', icon: '📝' },
  { path: '/review', label: '复习', icon: '🔄' },
]

const SubjectNav: React.FC<SubjectNavProps> = ({ subjectId, subjectName }) => {
  const navigate = useNavigate()
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => navigate('/subjects')} style={{
          padding: '6px 14px', borderRadius: radius.sm, border: `1px solid ${colors.border}`,
          backgroundColor: '#fff', fontSize: 13, cursor: 'pointer', color: colors.primary,
          display: 'flex', alignItems: 'center', gap: 4, transition,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.backgroundColor = colors.primaryLight }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = '#fff' }}
        >
          ← 返回科目列表
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{subjectName}</h2>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${colors.border}`, paddingBottom: 0 }}>
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={`/subjects/${subjectId}${tab.path}`}
            end={tab.path === ''}
            onMouseEnter={() => setHoveredTab(tab.path)}
            onMouseLeave={() => setHoveredTab(null)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? colors.primary : hoveredTab === tab.path ? colors.primary : colors.textSecondary,
              borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
              marginBottom: -2,
              transition,
            })}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default SubjectNav
