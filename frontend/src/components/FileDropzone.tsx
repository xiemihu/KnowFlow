import React, { useState, useRef } from 'react'
import { colors, radius, shadow, transition } from '../styles'

interface FileDropzoneProps {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
  accept?: string
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const fileTypeIcons: Record<string, string> = {
  pdf: '📕',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', bmp: '🖼️',
  mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
  mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬',
  txt: '📄', docx: '📄', doc: '📄',
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onUpload, uploading, accept }) => {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    await onUpload(selectedFile)
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const ext = selectedFile ? selectedFile.name.split('.').pop()?.toLowerCase() || '' : ''
  const icon = fileTypeIcons[ext] || '📄'

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? colors.primary : colors.border}`,
          borderRadius: radius.lg,
          padding: '32px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? colors.primaryLight : '#fafafa',
          transition,
          ...(dragOver ? { boxShadow: `0 0 0 4px ${colors.primaryLight}` } : {}),
        }}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileSelect}
          accept={accept}
          style={{ display: 'none' }}
        />
        {selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: colors.text }}>{selectedFile.name}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatSize(selectedFile.size)}</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>📁</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.textSecondary }}>
              {dragOver ? '释放文件以上传' : '拖拽文件到此处，或点击选择'}
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
              支持 PDF / 图片 / 音频 / 视频 / TXT / DOCX
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              flex: 1,
              padding: '10px 20px',
              borderRadius: radius.md,
              border: 'none',
              backgroundColor: uploading ? '#90caf9' : colors.primary,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition,
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? '上传中...' : '上传文件'}
          </button>
          <button
            onClick={() => setSelectedFile(null)}
            disabled={uploading}
            style={{
              padding: '10px 20px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              backgroundColor: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              transition,
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}

export default FileDropzone
