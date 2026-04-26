import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { quizApi, QuizItem } from '../api/subjects'
import { useToast } from '../components/Toast'
import { colors, radius, transition } from '../styles'

const QTYPES = [
  { id: 'single_choice', label: '单选题' },
  { id: 'multiple_choice', label: '多选题' },
  { id: 'fill', label: '填空题' },
  { id: 'subjective', label: '主观题' },
]

const Quiz: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<QuizItem[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [gradingIds, setGradingIds] = useState<Set<string>>(new Set())
  const [hoveredOption, setHoveredOption] = useState<Record<string, number>>({})

  const [count, setCount] = useState(3)
  const [difficulty, setDifficulty] = useState('medium')
  const [promptHint, setPromptHint] = useState('')
  const [qTypes, setQTypes] = useState<string[]>(['single_choice', 'fill'])
  const toast = useToast()

  const toggleQType = (tid: string) => {
    setQTypes(prev => prev.includes(tid) ? prev.filter(t => t !== tid) : [...prev, tid])
  }

  const handleGenerate = async () => {
    if (!id) return
    setLoading(true)
    setExercises([])
    setAnswers({})
    setResults({})
    try {
      const res = await quizApi.generateBatch(id, count, difficulty, promptHint, qTypes.length > 0 ? qTypes : undefined)
      setExercises(res.exercises)
      if (res.exercises.length === 0) toast.showToast('未能生成习题，请检查模型配置和知识点', 'error')
      else toast.showToast(`已生成 ${res.total} 道习题`, 'success')
    } catch (e: any) {
      toast.showToast('生成失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const setAnswer = (exId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [exId]: val }))
  }

  const toggleChoice = (exId: string, qType: string, val: string, current: string) => {
    if (qType === 'single_choice') {
      setAnswer(exId, val)
    } else {
      const existing = current ? current.split(',') : []
      const idx = existing.indexOf(val)
      if (idx >= 0) existing.splice(idx, 1); else existing.push(val)
      setAnswer(exId, existing.join(','))
    }
  }

  const handleGrade = async (exId: string) => {
    const answer = (answers[exId] || '').trim()
    if (!answer) { toast.showToast('请先输入答案', 'error'); return }
    setGradingIds(prev => new Set(prev).add(exId))
    try {
      const res = await quizApi.grade(exId, answer)
      setResults(prev => ({ ...prev, [exId]: res }))
    } catch (e: any) {
      toast.showToast('批改失败', 'error')
    } finally {
      setGradingIds(prev => { const n = new Set(prev); n.delete(exId); return n })
    }
  }

  return (
    <div>
      <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>📝 生成习题</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>数量</span>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', backgroundColor: '#fff' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}题</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>难度</span>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', backgroundColor: '#fff' }}>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>题型</span>
            {QTYPES.map(qt => (
              <label key={qt.id} style={{
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                padding: '3px 8px', borderRadius: 4,
                backgroundColor: qTypes.includes(qt.id) ? '#e3f2fd' : '#f3f4f6',
                color: qTypes.includes(qt.id) ? '#1976d2' : '#6b7280',
                fontWeight: qTypes.includes(qt.id) ? 600 : 400,
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}>
                <input type="checkbox" checked={qTypes.includes(qt.id)} onChange={() => toggleQType(qt.id)} style={{ display: 'none' }} />
                {qt.label}
              </label>
            ))}
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <button onClick={handleGenerate} disabled={loading}
              style={{
                padding: '8px 24px', borderRadius: 6, border: 'none',
                backgroundColor: loading ? '#90caf9' : colors.primary,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition, fontFamily: 'inherit',
                letterSpacing: 0.3,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = colors.primaryHover }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = loading ? '#90caf9' : colors.primary }}>
              {loading ? '⏳ 生成中...' : '🎯 生成'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <textarea
              value={promptHint}
              onChange={e => setPromptHint(e.target.value)}
              placeholder="（可选）输入提示词引导 AI 出题方向..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                transition,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryLight}` }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>
      </div>

      {exercises.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999', backgroundColor: '#fff', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <p>配置数量和类型，点击"生成"开始练习</p>
          <p style={{ fontSize: 13 }}>系统会基于薄弱知识点逐步生成，选择题自带答案和解析</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {exercises.map((ex, idx) => {
          const result = results[ex.id]
          const grading = gradingIds.has(ex.id)
          const answer = answers[ex.id] || ''
          const isChoice = ex.type === 'single_choice' || ex.type === 'multiple_choice'
          const isMultiple = ex.type === 'multiple_choice'

          return (
            <div key={ex.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#666' }}>
                  第 {idx + 1} 题 · {QTYPES.find(q => q.id === ex.type)?.label || ex.type} · {ex.kp_name}
                </span>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>{ex.question}</p>

              {isChoice && ex.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {ex.options.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi)
                    const selected = isMultiple ? answer.includes(letter) : answer === letter
                    const isHovered = hoveredOption[ex.id] === oi
                    return (
                      <label key={oi} onClick={() => toggleChoice(ex.id, ex.type, letter, answer)}
                        onMouseEnter={() => setHoveredOption(prev => ({ ...prev, [ex.id]: oi }))}
                        onMouseLeave={() => setHoveredOption(prev => ({ ...prev, [ex.id]: -1 }))}
                        style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
                        backgroundColor: selected ? (result ? (result.is_correct ? '#d1fae5' : '#fee2e2') : '#e3f2fd') : isHovered ? '#f3f4f6' : '#f9fafb',
                        border: selected ? '1px solid #1976d2' : '1px solid transparent',
                        transition,
                      }}>
                        <input type={isMultiple ? 'checkbox' : 'radio'} checked={selected} readOnly />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {ex.type === 'fill' && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>你的答案：</span>
                  <input value={answer} onChange={e => setAnswer(ex.id, e.target.value)}
                    disabled={!!result} placeholder="输入答案..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
                </div>
              )}

              {ex.type === 'subjective' && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>你的答案：</span>
                  <textarea value={answer} onChange={e => setAnswer(ex.id, e.target.value)}
                    disabled={!!result} placeholder="输入答案..." rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, outline: 'none', resize: 'vertical' }} />
                </div>
              )}

              {!result && (
                <button onClick={() => handleGrade(ex.id)} disabled={grading || !answer.trim()}
                  style={{ padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: grading ? 'not-allowed' : 'pointer', opacity: grading ? 0.7 : 1, transition }}
                  onMouseEnter={e => { if (!grading) e.currentTarget.style.backgroundColor = '#15803d' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#16a34a' }}>
                  {grading ? '批改中...' : '提交'}
                </button>
              )}

              {result && (
                <div style={{
                  padding: 14, borderRadius: 8, marginTop: 12,
                  backgroundColor: result.is_correct ? '#d1fae5' : '#fee2e2',
                  }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: result.is_correct ? '#065f46' : '#991b1b' }}>
                      {result.is_correct ? '✅ 正确' : '❌ 错误'}
                      {result.grading_detail?.score !== undefined && `（${result.grading_detail.score}分）`}
                    </p>
                    <p style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>正确答案: <strong>{result.correct_answer}</strong></p>
                    <p style={{ fontSize: 14, color: '#6b7280' }}>{result.explanation}</p>
                    {result.grading_detail?.comment && (
                      <p style={{ fontSize: 13, color: '#374151', marginTop: 6, backgroundColor: '#fff', padding: '8px 12px', borderRadius: 6 }}>
                        批改评语: {result.grading_detail.comment}
                      </p>
                    )}
                    {result.grading_detail?.corrected_answer && (
                      <p style={{ fontSize: 13, color: '#1976d2', marginTop: 4 }}>参考修正: {result.grading_detail.corrected_answer}</p>
                    )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Quiz
