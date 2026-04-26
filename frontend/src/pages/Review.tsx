import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { reviewApi, ReviewPlanResponse, ReviewGuideResponse } from '../api/subjects'
import { colors, radius, shadow, transition } from '../styles'

const Review: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<ReviewPlanResponse | null>(null)
  const [guide, setGuide] = useState<ReviewGuideResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadReview()
  }, [id])

  const loadReview = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [planRes, guideRes] = await Promise.all([
        reviewApi.plan(id),
        reviewApi.guide(id),
      ])
      setPlan(planRes)
      setGuide(guideRes)
    } catch (e) {
      console.error('Failed to load review', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>复习计划正在加载中，请耐心等待...</div>
      ) : (
        <>
          {plan && (
            <div style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 24, boxShadow: shadow.card }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📊 复习概览</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ textAlign: 'center', padding: '14px 12px', backgroundColor: '#f0fdf4', borderRadius: radius.md, transition, cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadow.elevated }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{plan.mastered}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>已掌握</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 12px', backgroundColor: '#fffbeb', borderRadius: radius.md, transition, cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadow.elevated }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#d97706' }}>{plan.learning}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>学习中</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 12px', backgroundColor: '#fee2e2', borderRadius: radius.md, transition, cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadow.elevated }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{plan.weak}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>薄弱</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 12px', backgroundColor: '#eef2ff', borderRadius: radius.md, transition, cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadow.elevated }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4f46e5' }}>{(plan.average_mastery * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>平均掌握度</div>
                </div>
              </div>

              {plan.today_review.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>今日复习推荐</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {plan.today_review.map(item => (
                      <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: radius.sm,
                        fontSize: 13,
                        transition,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.hoverBg }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                      >
                        <span>{item.name}</span>
                        <span style={{ color: item.mastery < 0.4 ? '#c62828' : item.mastery < 0.7 ? '#e65100' : '#2e7d32' }}>
                          掌握度: {(item.mastery * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {guide && (
            <div style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 24, boxShadow: shadow.card }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>🔄 复习向导</h3>
              {guide.remaining > 0 ? (
                <>
                  <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
                    剩余 {guide.remaining} 个薄弱知识点需要复习
                  </p>
                  <div style={{
                    padding: 16,
                    backgroundColor: '#f8f9fa',
                    borderRadius: radius.md,
                    fontSize: 14,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {guide.guide}
                  </div>
                  <button
                    onClick={loadReview}
                    style={{
                      marginTop: 16,
                      padding: '10px 20px',
                      borderRadius: radius.md,
                      border: 'none',
                      backgroundColor: colors.primary,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.primaryHover }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.primary }}
                  >
                    刷新复习内容
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#2e7d32' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <p style={{ fontSize: 16 }}>你已经掌握了该科目的所有知识点！</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Review
