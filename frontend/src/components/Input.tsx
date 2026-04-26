import React, { useState } from 'react'
import { colors, radius, transition } from '../styles'

interface InputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  multiline?: boolean
  rows?: number
  style?: React.CSSProperties
  type?: string
  accept?: string
}

const Input: React.FC<InputProps> = ({
  value, onChange, placeholder, onKeyDown, multiline, rows = 3, style, type, accept,
}) => {
  const [focused, setFocused] = useState(false)

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: radius.md,
    border: `1px solid ${focused ? colors.primary : colors.border}`,
    fontSize: 14,
    outline: 'none',
    transition,
    boxShadow: focused ? `0 0 0 3px ${colors.primaryLight}` : 'none',
    resize: multiline ? 'vertical' : 'none',
    fontFamily: 'inherit',
    ...style,
  }

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={baseStyle}
      />
    )
  }

  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accept={accept}
      style={baseStyle}
    />
  )
}

export default Input
