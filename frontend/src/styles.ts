import React from 'react'

export const colors = {
  primary: '#1976d2',
  primaryHover: '#1565c0',
  primaryLight: '#e3f2fd',
  secondary: '#4fc3f7',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  bg: '#f5f7fa',
  card: '#fff',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  sidebarBg: '#1a1a2e',
  sidebarText: 'rgba(255,255,255,0.7)',
  sidebarActive: '#4fc3f7',
  hoverBg: '#f9fafb',
}

export const radius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 }

export const shadow = {
  card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  elevated: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
  modal: '0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
}

export const transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'

export function useHover() {
  const [hovered, setHovered] = React.useState(false)
  return {
    hovered,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }
}
