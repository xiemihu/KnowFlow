import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { colors, radius, transition } from '../styles'

function stripMarkdown(md: string): string {
  return md
    .replace(/^###\s+/gm, '')
    .replace(/^##\s+/gm, '')
    .replace(/^#\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function useCopy(initialText: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(initialText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return { copied, copy }
}

const CopyBtn: React.FC<{ onClick: () => void; copied: boolean; label: string }> = ({ onClick, copied, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: '3px 10px',
      borderRadius: radius.xs,
      border: `1px solid ${copied ? '#10b981' : '#d1d5db'}`,
      backgroundColor: copied ? '#d1fae5' : '#f9fafb',
      color: copied ? '#065f46' : colors.textSecondary,
      fontSize: 11,
      cursor: 'pointer',
      transition,
      fontFamily: 'inherit',
    }}
    onMouseEnter={e => { if (!copied) { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af' } }}
    onMouseLeave={e => { if (!copied) { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db' } }}
  >
    {copied ? '✓ 已复制' : label}
  </button>
)

const CodeBlock: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const [hovered, setHovered] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const { copied, copy } = useCopy(code)
  return (
    <div
      style={{ position: 'relative', margin: '8px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
          <CopyBtn onClick={copy} copied={copied} label="复制代码" />
        </div>
      )}
      <pre style={{
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        padding: '14px 16px',
        borderRadius: radius.md,
        fontSize: 13,
        lineHeight: 1.6,
        overflow: 'auto',
        fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      }}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div style={{
      fontSize: 14,
      lineHeight: 1.7,
      color: '#1a1a2e',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ className, children, ...props }) {
          const isInline = !className
          if (isInline) {
            return (
              <code style={{
                backgroundColor: '#f1f5f9',
                color: '#1e293b',
                padding: '2px 5px',
                borderRadius: 3,
                fontSize: '0.9em',
                fontFamily: "'Fira Code', 'Consolas', monospace",
              }} {...props}>
                {children}
              </code>
            )
          }
          return <CodeBlock className={className}>{children}</CodeBlock>
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>
              {children}
            </a>
          )
        },
        table({ children }) {
          return (
            <div style={{ overflow: 'auto', margin: '8px 0' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', backgroundColor: '#f3f4f6', fontWeight: 600, textAlign: 'left' }}>{children}</th>
        },
        td({ children }) {
          return <td style={{ border: '1px solid #d1d5db', padding: '6px 10px' }}>{children}</td>
        },
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: `4px solid ${colors.primary}`,
              padding: '8px 16px',
              margin: '8px 0',
              backgroundColor: '#f8fafc',
              borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
              color: '#475569',
            }}>
              {children}
            </blockquote>
          )
        },
        hr() {
          return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
        },
        ul({ children }) {
          return <ul style={{ paddingLeft: 20, margin: '6px 0', lineHeight: 1.8 }}>{children}</ul>
        },
        ol({ children }) {
          return <ol style={{ paddingLeft: 20, margin: '6px 0', lineHeight: 1.8 }}>{children}</ol>
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}

const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => {
  const txt = stripMarkdown(content)
  const { copied: mdCopied, copy: copyMd } = useCopy(content)
  const { copied: txtCopied, copy: copyTxt } = useCopy(txt)

  return (
    <div>
      <div style={{ overflow: 'hidden' }}>
        <MarkdownRenderer content={content} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
        <CopyBtn onClick={copyMd} copied={mdCopied} label="复制 MD" />
        <CopyBtn onClick={copyTxt} copied={txtCopied} label="复制 TXT" />
      </div>
    </div>
  )
}

export { MarkdownRenderer, MarkdownMessage, stripMarkdown }
export default MarkdownMessage
