import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { chatApi, conversationApi } from '../api/subjects'
import { useToast } from '../components/Toast'
import { colors, radius, transition } from '../styles'
import MarkdownMessage from '../components/MarkdownMessage'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ConvItem {
  id: string
  title: string
  message_count: number
  updated_at: string
}

const Chat: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ConvItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!id) return
    loadConversations()
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    if (!id) return
    try {
      const res = await conversationApi.list(id)
      setConversations(res.conversations)
      if (res.conversations.length > 0) {
        const first = res.conversations[0]
        setActiveConvId(first.id)
        loadHistory(first.id)
      } else {
        setLoading(false)
      }
    } catch (e) {
      setLoading(false)
    }
  }

  const loadHistory = async (convId: string) => {
    if (!id) return
    setLoading(true)
    try {
      const res = await chatApi.history(id, convId)
      setMessages(res.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
    } catch (e) {
      console.error('Failed to load history', e)
    } finally {
      setLoading(false)
    }
  }

  const switchConversation = (convId: string) => {
    setActiveConvId(convId)
    loadHistory(convId)
  }

  const handleNewConversation = async () => {
    if (!id) return
    try {
      const res = await conversationApi.create(id, '新对话')
      setConversations(prev => [{ id: res.id, title: res.title, message_count: 0, updated_at: res.created_at }, ...prev])
      setActiveConvId(res.id)
      setMessages([])
      toast.showToast('已创建新对话', 'success')
    } catch (e: any) {
      toast.showToast('创建失败', 'error')
    }
  }

  const handleRename = async (convId: string, currentTitle: string) => {
    const newTitle = window.prompt('重命名对话：', currentTitle)
    if (!newTitle || newTitle === currentTitle) return
    try {
      await conversationApi.rename(convId, newTitle)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle } : c))
      toast.showToast('重命名成功', 'success')
    } catch (e) {
      toast.showToast('重命名失败', 'error')
    }
  }

  const handleDeleteConv = async (convId: string) => {
    if (!window.confirm('确定删除该对话及其所有消息？')) return
    try {
      await conversationApi.delete(convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (activeConvId === convId) {
        setActiveConvId(null)
        setMessages([])
        const remaining = conversations.filter(c => c.id !== convId)
        if (remaining.length > 0) {
          const next = remaining[0]
          setActiveConvId(next.id)
          loadHistory(next.id)
        }
      }
      toast.showToast('对话已删除', 'success')
    } catch (e) {
      toast.showToast('删除失败', 'error')
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !id || sending) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await chatApi.send(id, input, activeConvId || undefined)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer }])
      if (res.conversation_id && !activeConvId) {
        setActiveConvId(res.conversation_id)
        setConversations(prev => [{ id: res.conversation_id!, title: input.slice(0, 50), message_count: 1, updated_at: new Date().toISOString() }, ...prev])
      }
    } catch (e: any) {
      toast.showToast('发送失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 200px)' }}>
      <div style={{
        width: 240, minWidth: 220, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>💬 对话记录</span>
          <button onClick={handleNewConversation} style={{
            padding: '4px 10px', borderRadius: radius.sm, border: 'none', backgroundColor: colors.primary,
            color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition,
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.primaryHover }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.primary }}
          >＋新建</button>
        </div>
        {conversations.length === 0 ? (
          <p style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: 20 }}>暂无对话</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {conversations.map(conv => {
              const isActive = activeConvId === conv.id
              const isHovered = hoveredConv === conv.id
              return (
                <div
                  key={conv.id}
                  onClick={() => switchConversation(conv.id)}
                  onMouseEnter={() => setHoveredConv(conv.id)}
                  onMouseLeave={() => setHoveredConv(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px',
                    borderRadius: radius.md, cursor: 'pointer', fontSize: 13,
                    backgroundColor: isActive ? colors.primaryLight : isHovered ? colors.hoverBg : 'transparent',
                    transition,
                  }}
                >
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? colors.primary : colors.text,
                  }}>{conv.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleRename(conv.id, conv.title) }}
                    style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, opacity: isHovered ? 1 : 0.4, transition }}
                  >✏️</button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                    style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, opacity: isHovered ? 1 : 0.4, transition }}
                  >🗑️</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{
        flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column',
        minWidth: 0,
      }}>
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 13, color: colors.textSecondary }}>
          {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title || '对话') : '新对话'}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20, backgroundColor: '#fafbfc' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: colors.textTertiary }}>加载中...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: colors.textTertiary }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <p style={{ fontSize: 15 }}>开始与你的学习助手对话</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>发送消息将自动创建或加入当前对话</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
                animation: i === messages.length - 1 ? 'fadeSlideIn 0.25s ease' : undefined,
              }}>
                {msg.role === 'user' ? (
                  <div style={{
                    maxWidth: '70%',
                    padding: '12px 18px',
                    borderRadius: '16px 16px 4px 16px',
                    backgroundColor: colors.primary,
                    color: '#fff',
                    fontSize: 14,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{
                    maxWidth: '75%',
                    padding: '14px 18px',
                    borderRadius: '16px 16px 16px 4px',
                    backgroundColor: colors.card,
                    color: colors.text,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    position: 'relative' as const,
                  }}>
                    <MarkdownMessage content={msg.content} />
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div key="sending" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{ padding: '12px 18px', borderRadius: '16px 16px 16px 4px', backgroundColor: colors.card, color: colors.textTertiary, fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                思考中...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
          <style>{`
            @keyframes fadeSlideIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="输入你的问题..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: radius.md,
              border: `1px solid ${inputFocused ? colors.primary : colors.border}`,
              fontSize: 14,
              outline: 'none',
              transition,
              boxShadow: inputFocused ? `0 0 0 3px ${colors.primaryLight}` : 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              padding: '10px 24px',
              borderRadius: radius.md,
              border: 'none',
              backgroundColor: sending ? '#90caf9' : colors.primary,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: sending || !input.trim() ? 0.6 : 1,
              transition,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!sending && input.trim()) e.currentTarget.style.backgroundColor = colors.primaryHover }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = sending ? '#90caf9' : colors.primary }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chat
