import React from 'react'
import { colors, radius } from '../styles'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const badgeStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: '#d1fae5', color: '#065f46' },
  warning: { bg: '#fef3c7', color: '#92400e' },
  danger: { bg: '#fee2e2', color: '#991b1b' },
  info: { bg: colors.primaryLight, color: colors.primaryHover },
  default: { bg: colors.hoverBg, color: colors.textSecondary },
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const s = badgeStyles[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: radius.xs,
      backgroundColor: s.bg,
      color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export default Badge
