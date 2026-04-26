import React from 'react'
import { colors, radius, shadow, transition } from '../styles'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: 24,
          width: '90%',
          maxWidth: width,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: shadow.modal,
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {title && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: colors.textTertiary,
                padding: '4px 8px',
                borderRadius: radius.sm,
                transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.hoverBg; e.currentTarget.style.color = colors.text }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.textTertiary }}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

export default Modal
