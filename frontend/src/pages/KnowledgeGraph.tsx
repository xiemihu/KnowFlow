import React, { useState, useEffect, useCallback, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { knowledgeApi, groupApi, exerciseApi, KnowledgeGroupTreeResponse, KnowledgePointDetail, ExerciseItem } from '../api/subjects'
import { useToast } from '../components/Toast'
import { SubjectContext } from './SubjectLayout'
import { colors, radius, transition } from '../styles'
import Modal from '../components/Modal'
import Button from '../components/Button'

const KnowledgeGraph: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [tree, setTree] = useState<KnowledgeGroupTreeResponse | null>(null)
  const [selectedKpId, setSelectedKpId] = useState<string | null>(null)
  const [kpDetail, setKpDetail] = useState<KnowledgePointDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDesc, setEditingDesc] = useState('')

  const [viewingExercise, setViewingExercise] = useState<ExerciseItem | null>(null)
  const [loadingExercise, setLoadingExercise] = useState(false)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [confirmInfo, setConfirmInfo] = useState<{ type: 'group' | 'kp' | 'batch'; id?: string; text: string } | null>(null)
  const [autoOrganizing, setAutoOrganizing] = useState(false)

  const toast = useToast()
  const ctx = useContext(SubjectContext)
  const refreshSubject = ctx?.refreshSubject

  useEffect(() => {
    if (!id) return
    loadTree()
  }, [id])

  const loadTree = useCallback(async () => {
    if (!id) return
    try {
      const res = await groupApi.tree(id)
      setTree(res)
    } catch (e) {
      toast.showToast('加载知识树失败', 'error')
    }
  }, [id])

  useEffect(() => {
    if (!selectedKpId) return
    setLoadingDetail(true)
    knowledgeApi.detail(selectedKpId).then(setKpDetail).catch(() => {
      toast.showToast('加载知识点详情失败', 'error')
    }).finally(() => setLoadingDetail(false))
  }, [selectedKpId])

  const handleSearch = useCallback(async () => {
    if (!id) return
    if (!searchQuery.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const res = await knowledgeApi.search(id, searchQuery)
      setSearchResults(res)
    } catch (e) { toast.showToast('搜索失败', 'error') }
    finally { setSearching(false) }
  }, [id, searchQuery])

  const toggleCheck = (kpId: string) => {
    setCheckedIds(prev => { const n = new Set(prev); if (n.has(kpId)) n.delete(kpId); else n.add(kpId); return n })
  }

  const handleBatchDelete = async () => {
    if (checkedIds.size === 0) return
    setConfirmInfo({ type: 'batch', text: `确定删除选中的 ${checkedIds.size} 个知识点？` })
  }

  const startEdit = (id: string, name: string, desc: string = '') => {
    setEditingId(id); setEditingName(name); setEditingDesc(desc)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    try {
      await knowledgeApi.update(editingId, { name: editingName, description: editingDesc })
      toast.showToast('保存成功', 'success'); setEditingId(null); loadTree()
      if (selectedKpId === editingId) setKpDetail(prev => prev ? { ...prev, name: editingName, description: editingDesc } : prev)
      refreshSubject?.()
    } catch (e) { toast.showToast('保存失败', 'error') }
  }

  const handleRenameGroup = async (groupId: string, currentName: string) => {
    const newName = prompt('重命名知识组：', currentName)
    if (!newName || newName === currentName) return
    try { await groupApi.update(groupId, { name: newName }); toast.showToast('重命名成功', 'success'); loadTree(); refreshSubject?.() }
    catch (e) { toast.showToast('重命名失败', 'error') }
  }

  const handleDeleteGroup = (groupId: string) => {
    setConfirmInfo({ type: 'group', id: groupId, text: '确定删除该知识组及其下的所有知识点？' })
  }

  const handleDeleteKp = (kpId: string) => {
    setConfirmInfo({ type: 'kp', id: kpId, text: '确定删除该知识点？' })
  }

  const executeDelete = async () => {
    if (!confirmInfo) return
    const info = confirmInfo
    setConfirmInfo(null)
    try {
      if (info.type === 'batch') {
        await knowledgeApi.batchDelete([...checkedIds])
        setCheckedIds(new Set())
        if (selectedKpId && checkedIds.has(selectedKpId)) { setSelectedKpId(null); setKpDetail(null) }
      } else if (info.type === 'group' && info.id) {
        await groupApi.delete(info.id)
      } else if (info.type === 'kp' && info.id) {
        await knowledgeApi.deletePoint(info.id)
      }
      toast.showToast('删除成功', 'success')
      loadTree()
      refreshSubject?.()
    } catch (e) {
      toast.showToast('删除失败', 'error')
    }
  }

  const handleViewExercise = async (exerciseId: string) => {
    setLoadingExercise(true)
    try {
      const res = await exerciseApi.getDetail(exerciseId)
      setViewingExercise(res)
    } catch (e) {
      toast.showToast('加载习题详情失败', 'error')
    } finally {
      setLoadingExercise(false)
    }
  }

  const handleAutoOrganize = async () => {
    if (!id) return
    setAutoOrganizing(true)
    try {
      const res = await groupApi.autoGroup(id)
      await loadTree()
      refreshSubject?.()
      toast.showToast(`整理完成：归并 ${res.merged} 个冗余，创建 ${res.groups_created} 个组，覆盖 ${res.total_kps} 个知识点${res.empty_deleted ? `，删除 ${res.empty_deleted} 个空组` : ''}`, 'success')
    } catch (e: any) {
      toast.showToast('自动整理失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setAutoOrganizing(false)
    }
  }

  if (!id) return null

  const allGroups = tree?.groups || []
  const ungrouped = tree?.ungrouped || []
  const colorPalette = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec', '#e0f7fa', '#f1f8e9', '#fff8e1']

  const toggleGroup = (gid: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); if (n.has(gid)) n.delete(gid); else n.add(gid); return n })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 200px)' }}>
        <div style={{
          width: 320, minWidth: 300,
          backgroundColor: '#fff', borderRadius: 12, padding: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>📁 知识管理</span>
            <Button variant="ghost" size="sm" onClick={handleAutoOrganize} disabled={autoOrganizing}>
              {autoOrganizing ? '整理中...' : '🔄 自动整理'}
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索知识点..." style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, outline: 'none', transition }}
              onFocus={e => { e.target.style.borderColor = colors.primary; e.target.style.boxShadow = `0 0 0 2px ${colors.primaryLight}` }}
              onBlur={e => { e.target.style.borderColor = '#ddd'; e.target.style.boxShadow = 'none' }}
            />
            <button onClick={handleSearch} disabled={searching} style={{
              padding: '5px 8px', borderRadius: 6, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 12, cursor: 'pointer', transition,
            }}
              onMouseEnter={e => { if (!searching) e.currentTarget.style.backgroundColor = colors.primaryHover }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.primary }}
            >{searching ? '...' : '🔍'}</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={handleBatchDelete} disabled={checkedIds.size === 0} style={{
              padding: '3px 8px', borderRadius: 4, border: '1px solid #ef5350',
              backgroundColor: checkedIds.size === 0 ? '#f5f5f5' : '#fff', color: '#ef5350',
              fontSize: 11, cursor: 'pointer', flex: 1,
            }}>删除选中 ({checkedIds.size})</button>
            {searchResults && (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null) }} style={{
                padding: '3px 8px', borderRadius: 4, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 11, cursor: 'pointer',
              }}>清除搜索</button>
            )}
          </div>

          {searchResults !== null ? (
            <div>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>搜索结果 ({searchResults.length})</p>
              {searchResults.map((kp: any) => (
                <div key={kp.id} onClick={() => setSelectedKpId(kp.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                  backgroundColor: selectedKpId === kp.id ? '#e3f2fd' : 'transparent', marginBottom: 1,
                }}>
                  <input type="checkbox" checked={checkedIds.has(kp.id)} onChange={() => toggleCheck(kp.id)} onClick={e => e.stopPropagation()} />
                  <span style={{ flex: 1 }}>{kp.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {allGroups.map((group, gi) => {
                const color = colorPalette[gi % colorPalette.length]
                const isExp = expandedGroups.has(group.id)
                return (
                  <div key={group.id} style={{ marginBottom: 4, borderRadius: 6, border: `1px solid ${color}`, overflow: 'hidden' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px',
                      backgroundColor: isExp ? color : '#fafafa', fontSize: 12, cursor: 'pointer',
                    }} onClick={() => toggleGroup(group.id)}>
                      <span>{isExp ? '📂' : '📁'}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{group.name}</span>
                      <span style={{ fontSize: 10, color: '#666' }}>{group.kp_count}</span>
                      <button onClick={e => { e.stopPropagation(); handleRenameGroup(group.id, group.name) }} style={{ padding: '1px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666' }}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id) }} style={{ padding: '1px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#ef5350' }}>🗑️</button>
                    </div>
                    {isExp && (
                      <div style={{ padding: '2px 4px 4px' }}>
                        {group.knowledge_points.length > 0 && (
                          <div style={{ padding: '1px 4px', marginBottom: 2 }}>
                            <input type="checkbox" checked={group.knowledge_points.every(k => checkedIds.has(k.id))}
                              onChange={() => {
                                const kpIds = group.knowledge_points.map(k => k.id)
                                setCheckedIds(prev => {
                                  const n = new Set(prev)
                                  const all = kpIds.every(id => n.has(id))
                                  kpIds.forEach(id => all ? n.delete(id) : n.add(id))
                                  return n
                                })
                              }}
                              style={{ transform: 'scale(0.8)' }} />
                            <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>全选</span>
                          </div>
                        )}
                        {group.knowledge_points.map(kp => (
                          <div key={kp.id} onClick={() => setSelectedKpId(kp.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px', borderRadius: 3, fontSize: 12, cursor: 'pointer',
                            backgroundColor: selectedKpId === kp.id ? '#e3f2fd' : 'transparent', marginBottom: 1, transition,
                          }}
                            onMouseEnter={e => { if (selectedKpId !== kp.id) e.currentTarget.style.backgroundColor = colors.hoverBg }}
                            onMouseLeave={e => { if (selectedKpId !== kp.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <input type="checkbox" checked={checkedIds.has(kp.id)} onChange={() => toggleCheck(kp.id)} onClick={e => e.stopPropagation()} style={{ transform: 'scale(0.8)' }} />
                            {(kp as any).is_important && <span style={{ fontSize: 11 }}>⭐</span>}
                            {(kp as any).is_difficult && <span style={{ fontSize: 11 }}>🔥</span>}
                            <span style={{ flex: 1 }}>{kp.name}</span>
                            <div style={{
                              fontSize: 10, padding: '0 6px', borderRadius: 6,
                              backgroundColor: kp.mastery >= 0.8 ? '#e8f5e9' : kp.mastery >= 0.5 ? '#fff3e0' : '#ffebee',
                              color: kp.mastery >= 0.8 ? '#2e7d32' : kp.mastery >= 0.5 ? '#e65100' : '#c62828',
                            }}>{(kp.mastery * 100).toFixed(0)}%</div>
                            <button onClick={e => { e.stopPropagation(); startEdit(kp.id, kp.name, kp.description) }} style={{ padding: '1px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666' }}>✏️</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ borderRadius: 6, border: '1px dashed #ddd', overflow: 'hidden' }}>
                <div onClick={() => toggleGroup('__ungrouped')} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px',
                  backgroundColor: expandedGroups.has('__ungrouped') ? '#e0e0e0' : '#f5f5f5', fontSize: 12, cursor: 'pointer',
                }}>
                  <span>📁</span>
                  <span style={{ flex: 1 }}>未分类</span>
                  <span style={{ fontSize: 10, color: '#666' }}>{ungrouped.length}</span>
                </div>
                {expandedGroups.has('__ungrouped') && (
                  <div style={{ padding: '2px 4px 4px' }}>
                    {ungrouped.length > 0 && (
                      <div style={{ padding: '1px 4px', marginBottom: 2 }}>
                        <input type="checkbox" checked={ungrouped.every(k => checkedIds.has(k.id))}
                          onChange={() => {
                            const ids = ungrouped.map(k => k.id)
                            setCheckedIds(prev => {
                              const n = new Set(prev); const all = ids.every(id => n.has(id))
                              ids.forEach(id => all ? n.delete(id) : n.add(id)); return n
                            })
                          }}
                          style={{ transform: 'scale(0.8)' }} />
                        <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>全选</span>
                      </div>
                    )}
                    {ungrouped.map(kp => (
                      <div key={kp.id} onClick={() => setSelectedKpId(kp.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px', fontSize: 12, cursor: 'pointer', marginBottom: 1, transition,
                        backgroundColor: selectedKpId === kp.id ? '#e3f2fd' : 'transparent',
                      }}
                        onMouseEnter={e => { if (selectedKpId !== kp.id) e.currentTarget.style.backgroundColor = colors.hoverBg }}
                        onMouseLeave={e => { if (selectedKpId !== kp.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <input type="checkbox" checked={checkedIds.has(kp.id)} onChange={() => toggleCheck(kp.id)} onClick={e => e.stopPropagation()} style={{ transform: 'scale(0.8)' }} />
                        {(kp as any).is_important && <span style={{ fontSize: 11 }}>⭐</span>}
                        {(kp as any).is_difficult && <span style={{ fontSize: 11 }}>🔥</span>}
                        <span style={{ flex: 1 }}>{kp.name}</span>
                        <button onClick={e => { e.stopPropagation(); startEdit(kp.id, kp.name, kp.description) }} style={{ padding: '1px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666' }}>✏️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {selectedKpId ? (
            <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>🧠 知识点详情</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { if (kpDetail) startEdit(kpDetail.id, kpDetail.name, kpDetail.description) }} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 12, cursor: 'pointer',
                  }}>编辑</button>
                  <button onClick={() => handleDeleteKp(selectedKpId)} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #ef5350', backgroundColor: '#fff', color: '#ef5350', fontSize: 12, cursor: 'pointer',
                  }}>删除</button>
                </div>
              </div>

              {loadingDetail ? (
                <p style={{ color: '#999' }}>加载中...</p>
              ) : kpDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>{kpDetail.name}</p>
                      <button onClick={async () => {
                        const val = !kpDetail.is_important
                        await knowledgeApi.update(kpDetail.id, { is_important: val })
                        setKpDetail({ ...kpDetail, is_important: val })
                        loadTree()
                      }} style={{
                        padding: '3px 8px', borderRadius: 4, border: '1px solid', fontSize: 11, cursor: 'pointer',
                        backgroundColor: kpDetail.is_important ? '#fff3cd' : '#fff', borderColor: kpDetail.is_important ? '#f0ad4e' : '#ddd',
                      }}>{kpDetail.is_important ? '⭐ 已标记重点' : '⭐ 标记重点'}</button>
                      <button onClick={async () => {
                        const val = !kpDetail.is_difficult
                        await knowledgeApi.update(kpDetail.id, { is_difficult: val })
                        setKpDetail({ ...kpDetail, is_difficult: val })
                        loadTree()
                      }} style={{
                        padding: '3px 8px', borderRadius: 4, border: '1px solid', fontSize: 11, cursor: 'pointer',
                        backgroundColor: kpDetail.is_difficult ? '#ffcdd2' : '#fff', borderColor: kpDetail.is_difficult ? '#e53935' : '#ddd',
                      }}>{kpDetail.is_difficult ? '🔥 已标记难点' : '🔥 标记难点'}</button>
                    </div>
                    <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{kpDetail.description || '暂无描述'}</p>
                    <div style={{
                      display: 'inline-block', padding: '3px 14px', borderRadius: 12, fontSize: 13,
                      backgroundColor: kpDetail.mastery >= 0.8 ? '#e8f5e9' : kpDetail.mastery >= 0.5 ? '#fff3e0' : '#ffebee',
                      color: kpDetail.mastery >= 0.8 ? '#2e7d32' : kpDetail.mastery >= 0.5 ? '#e65100' : '#c62828',
                    }}>掌握度: {(kpDetail.mastery * 100).toFixed(0)}%</div>
                  </div>

                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📄 来源资料 ({kpDetail.sources.length})</p>
                    {kpDetail.sources.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#999' }}>暂无来源资料</p>
                    ) : (
                      kpDetail.sources.map((s, i) => (
                        <div key={i} style={{ padding: '8px 12px', marginBottom: 6, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📄 {s.filename}</div>
                          <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>{s.content}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📝 关联习题 ({kpDetail.exercises.length})</p>
                    {kpDetail.exercises.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#999' }}>暂无关联习题</p>
                    ) : (
                      kpDetail.exercises.map((ex, i) => (
                        <div key={i} onClick={() => handleViewExercise(ex.id)} style={{ padding: '8px 12px', marginBottom: 6, backgroundColor: '#f8f9fa', borderRadius: 6, cursor: 'pointer', border: '1px solid transparent', transition }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.hoverBg; e.currentTarget.style.borderColor = colors.primaryLight }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <div style={{ fontSize: 13, color: '#333' }}>{ex.question}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', gap: 8 }}>
                            <span>{ex.difficulty} · {ex.question_type}</span>
                            <span style={{ color: '#1976d2' }}>点击查看详情 →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, padding: 40, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999',
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
              <p style={{ fontSize: 16 }}>请在左侧选择一个知识点查看详情</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>展开知识组 → 点击知识点 → 查看详情、来源和习题</p>
            </div>
          )}
        </div>
      </div>

      {editingId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setEditingId(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>编辑知识点</h3>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>名称</label>
            <input value={editingName} onChange={e => setEditingName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 12, outline: 'none' }} />
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>描述</label>
            <textarea value={editingDesc} onChange={e => setEditingDesc(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 16, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingId(null)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 14, cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveEdit} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#1976d2', color: '#fff', fontSize: 14, cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!confirmInfo} onClose={() => setConfirmInfo(null)} title="确认删除" width={400}>
        {confirmInfo && (
          <div>
            <p style={{ fontSize: 15, color: '#333', marginBottom: 20, lineHeight: 1.6 }}>{confirmInfo.text}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setConfirmInfo(null)}>取消</Button>
              <Button variant="danger" onClick={executeDelete}>确认删除</Button>
            </div>
          </div>
        )}
      </Modal>

      {viewingExercise && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setViewingExercise(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>📝 习题详情</h3>
              <button onClick={() => setViewingExercise(null)} style={{
                padding: '4px 12px', borderRadius: 4, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 13, cursor: 'pointer',
              }}>关闭</button>
            </div>

            {loadingExercise ? (
              <p style={{ color: '#999' }}>加载中...</p>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#e3f2fd', color: '#1976d2' }}>
                      {viewingExercise.question_type === 'single_choice' ? '单选题' :
                       viewingExercise.question_type === 'multiple_choice' ? '多选题' :
                       viewingExercise.question_type === 'fill' ? '填空题' : '主观题'}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f3e5f5', color: '#7b1fa2' }}>
                      {viewingExercise.difficulty === 'easy' ? '简单' : viewingExercise.difficulty === 'hard' ? '困难' : '中等'}
                    </span>
                    {viewingExercise.kp_names.map((kn, ki) => (
                      <span key={ki} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#e8f5e9', color: '#388e3c' }}>
                        {kn}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>{viewingExercise.question}</p>

                  {viewingExercise.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                      {JSON.parse(viewingExercise.options).map((opt: string, oi: number) => (
                        <div key={oi} style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: '#f8f9fa', fontSize: 14 }}>
                          <span style={{ fontWeight: 600, marginRight: 8 }}>{String.fromCharCode(65 + oi)}.</span>
                          {opt.replace(/^[A-Z][.．]\s*/, '')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {viewingExercise.answer && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 6, backgroundColor: '#e8f5e9' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', marginBottom: 4 }}>正确答案</p>
                    <p style={{ fontSize: 14, color: '#333' }}>{viewingExercise.answer}</p>
                  </div>
                )}

                {viewingExercise.explanation && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 6, backgroundColor: '#fff3e0' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#e65100', marginBottom: 4 }}>解析</p>
                    <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{viewingExercise.explanation}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraph
