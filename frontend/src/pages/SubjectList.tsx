import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { subjectApi, Subject } from '../api/subjects'
import { useToast } from '../components/Toast'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { colors } from '../styles'

const SubjectList: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => { loadSubjects() }, [])

  const loadSubjects = async () => {
    setLoading(true)
    try {
      const res = await subjectApi.list()
      setSubjects(res.subjects)
    } catch (e: any) {
      toast.showToast('加载科目列表失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.showToast('请输入科目名称', 'error')
      return
    }
    setCreating(true)
    try {
      const subj = await subjectApi.create({ name: newName, description: newDesc })
      setSubjects(prev => [subj, ...prev])
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      toast.showToast('科目创建成功！', 'success')
    } catch (e: any) {
      toast.showToast('创建科目失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('确定删除该科目？所有相关资料将被删除。')) return
    try {
      await subjectApi.delete(id)
      setSubjects(prev => prev.filter(s => s.id !== id))
      toast.showToast('科目已删除', 'info')
    } catch (e: any) {
      toast.showToast('删除失败: ' + (e.response?.data?.detail || e.message), 'error')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: colors.textSecondary }}>加载中...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>📚 科目管理</h2>
        <Button onClick={() => setShowCreate(true)} size="lg">+ 新建科目</Button>
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewDesc('') }} title="新建科目" width={420}>
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="科目名称"
          style={{ marginBottom: 12 }}
        />
        <Input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="科目描述（可选）"
          style={{ marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}>取消</Button>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? '创建中...' : '创建'}
          </Button>
        </div>
      </Modal>

      {subjects.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
          <p style={{ color: colors.textSecondary }}>还没有科目，点击上方按钮创建第一个科目</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subjects.map(subj => (
            <Card
              key={subj.id}
              hoverable
              onClick={() => navigate(`/subjects/${subj.id}`)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{subj.name}</h3>
                <p style={{ fontSize: 13, color: colors.textSecondary }}>{subj.description || '暂无描述'}</p>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.textTertiary }}>📄 {subj.resource_count} 资料</span>
                <span style={{ fontSize: 13, color: colors.textTertiary }}>🧠 {subj.kp_count} 知识点</span>
                <span style={{ fontSize: 13, color: colors.textTertiary }}>📁 {subj.group_count} 组</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={e => handleDelete(subj.id, e)}
                >删除</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default SubjectList
