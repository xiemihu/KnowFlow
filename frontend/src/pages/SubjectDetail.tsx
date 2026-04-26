import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { resourceApi, Resource } from '../api/subjects'
import { useToast } from '../components/Toast'
import { SubjectContext } from './SubjectLayout'
import Card from '../components/Card'
import Badge from '../components/Badge'
import FileDropzone from '../components/FileDropzone'
import Button from '../components/Button'
import { colors, radius, transition } from '../styles'

const fileTypeIcons: Record<string, string> = {
  pdf: '📕',
  image: '🖼️',
  audio: '🎵',
  video: '🎬',
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  done: { variant: 'success', label: '已完成' },
  parsing: { variant: 'warning', label: '解析中' },
  failed: { variant: 'danger', label: '失败' },
  pending: { variant: 'info', label: '等待' },
}

const Spinner: React.FC = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{
      width: 22, height: 22,
      border: '3px solid #e5e7eb',
      borderTopColor: colors.primary,
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'kgSpin 0.6s linear infinite',
    }} />
  </span>
)

const StatCard: React.FC<{ label: string; value: string | number; bg: string; color: string; loading?: boolean }> = ({ label, value, bg, color, loading }) => (
  <div style={{ textAlign: 'center', padding: '16px 12px', backgroundColor: bg, borderRadius: radius.md }}>
    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
    {loading ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <Spinner />
      </div>
    ) : (
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    )}
  </div>
)

const SubjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const ctx = useContext(SubjectContext)
  const subject = ctx?.subject ?? null
  const statsLoading = ctx?.statsLoading ?? false
  const refreshSubject = ctx?.refreshSubject
  const [resources, setResources] = useState<Resource[]>([])
  const [uploading, setUploading] = useState(false)
  const [hoveredResource, setHoveredResource] = useState<string | null>(null)
  const toast = useToast()

  const loadData = useCallback(async () => {
    if (!id) return
    const [res] = await Promise.all([
      resourceApi.listBySubject(id),
      refreshSubject?.(),
    ])
    setResources(res.resources)
  }, [id, refreshSubject])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpload = async (file: File) => {
    if (!id) return
    setUploading(true)
    try {
      await resourceApi.upload(id, file)
      toast.showToast('资料上传成功，正在自动解析...', 'success')
      loadData()
    } catch (e: any) {
      toast.showToast('上传失败: ' + (e.response?.data?.detail || e.message), 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteResource = async (resourceId: string) => {
    if (!window.confirm('确定删除该资料？相关的知识图谱和切片也将被删除。')) return
    try {
      await resourceApi.delete(resourceId)
      setResources(prev => prev.filter(r => r.id !== resourceId))
      toast.showToast('资料已删除', 'success')
      refreshSubject?.()
    } catch (e: any) {
      toast.showToast('删除失败: ' + (e.response?.data?.detail || e.message), 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '2fr 1fr' }}>
      <div>
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📄 学习资料</h3>
          <FileDropzone onUpload={handleUpload} uploading={uploading} accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.txt,.docx" />

          {resources.length === 0 ? (
            <p style={{ color: colors.textTertiary, textAlign: 'center', padding: 20, marginTop: 12 }}>暂无资料，上传你的第一个学习资料</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              {resources.map(r => {
                const statusCfg = statusConfig[r.status] || statusConfig.pending
                return (
                  <div
                    key={r.id}
                    onMouseEnter={() => setHoveredResource(r.id)}
                    onMouseLeave={() => setHoveredResource(null)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: hoveredResource === r.id ? colors.hoverBg : '#f8f9fa',
                      borderRadius: radius.md,
                      fontSize: 13,
                      transition,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{fileTypeIcons[r.file_type] || '📄'}</span>
                      <span style={{ fontWeight: 500 }}>{r.filename}</span>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: colors.textTertiary }}>
                        {(r.file_size / 1024).toFixed(1)} KB
                      </span>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteResource(r.id)}>删除</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📊 科目概览</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard label="资料数" value={subject?.resource_count ?? 0} bg="#eef2ff" color="#4f46e5" loading={statsLoading} />
            <StatCard label="知识点" value={subject?.kp_count ?? 0} bg="#f5f3ff" color="#7c3aed" loading={statsLoading} />
            <StatCard label="知识组" value={subject?.group_count ?? 0} bg="#f0fdf4" color="#16a34a" loading={statsLoading} />
            <StatCard label="学习交互" value={subject?.interaction_count ?? 0} bg="#fffbeb" color="#d97706" loading={statsLoading} />
          </div>
        </Card>
      </div>
      <style>{`@keyframes kgSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default SubjectDetail
