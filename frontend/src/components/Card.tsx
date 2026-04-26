import React, { useState } from 'react'
import { colors, radius, shadow, transition } from '../styles'

interface CardProps {
  children: React.ReactNode
  hoverable?: boolean
  elevated?: boolean
  style?: React.CSSProperties
  onClick?: () => void
  padding?: number | string
}

const Card: React.FC<CardProps> = ({ children, hoverable, elevated, style, onClick, padding = 20 }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding,
        boxShadow: elevated ? shadow.elevated : shadow.card,
        cursor: onClick ? 'pointer' : undefined,
        transition,
        ...(hovered && hoverable
          ? { boxShadow: shadow.elevated, transform: 'translateY(-2px)' }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default Card
