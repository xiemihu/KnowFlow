import React, { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { colors, radius, transition } from '../styles'

const navItems = [
  { path: '/subjects', label: '科目管理', icon: '📚' },
  { path: '/model-config', label: '模型配置', icon: '🤖' },
]

const SidebarLink: React.FC<{ to: string; icon: string; label: string }> = ({ to, icon, label }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        color: isActive ? '#fff' : colors.sidebarText,
        backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: isActive ? 600 : 400,
        borderLeft: `3px solid ${isActive ? colors.sidebarActive : 'transparent'}`,
        transition,
      })}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

const Layout: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
      <nav style={{
        width: 220,
        backgroundColor: colors.sidebarBg,
        color: '#fff',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🧠</span>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>KnowFlow</h1>
              <p style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>智能学习助手</p>
            </div>
          </div>
        </div>
        {navItems.map(item => (
          <SidebarLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
        ))}
        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 11, opacity: 0.35 }}>v0.2</span>
        </div>
      </nav>
      <main style={{ flex: 1, padding: 24, overflow: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
