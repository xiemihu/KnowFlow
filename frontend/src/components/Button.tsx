import React, { useState } from 'react'
import { colors, radius, shadow, transition } from '../styles'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
  type?: 'button' | 'submit'
}

const variantStyles: Record<Variant, { normal: React.CSSProperties; hover: React.CSSProperties }> = {
  primary: {
    normal: { backgroundColor: colors.primary, color: '#fff', border: 'none' },
    hover: { backgroundColor: colors.primaryHover, boxShadow: shadow.elevated, transform: 'translateY(-1px)' },
  },
  secondary: {
    normal: { backgroundColor: '#fff', color: colors.text, border: `1px solid ${colors.border}` },
    hover: { borderColor: colors.primary, backgroundColor: colors.primaryLight, color: colors.primary },
  },
  danger: {
    normal: { backgroundColor: '#fff', color: colors.danger, border: `1px solid ${colors.danger}` },
    hover: { backgroundColor: colors.danger, color: '#fff', borderColor: colors.danger },
  },
  ghost: {
    normal: { backgroundColor: 'transparent', color: colors.textSecondary, border: 'none' },
    hover: { backgroundColor: colors.hoverBg, color: colors.text },
  },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '4px 12px', fontSize: 12, borderRadius: radius.sm },
  md: { padding: '8px 20px', fontSize: 14, borderRadius: radius.md },
  lg: { padding: '10px 24px', fontSize: 15, borderRadius: radius.md },
}

const Button: React.FC<ButtonProps> = ({ children, onClick, disabled, variant = 'primary', size = 'md', style, type }) => {
  const [hovered, setHovered] = useState(false)
  const v = variantStyles[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        transition,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...sizeStyles[size],
        ...v.normal,
        ...(hovered && !disabled ? v.hover : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export default Button
