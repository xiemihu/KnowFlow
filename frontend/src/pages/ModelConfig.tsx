import React, { useState, useEffect } from 'react'
import { modelConfigApi, ProviderInfo } from '../api/subjects'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { colors, radius, transition } from '../styles'

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"] },
  { id: "google", name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "aliyun", name: "阿里通义千问", models: ["qwen-vl-max", "qwen-vl-plus", "qwen2.5-72b-instruct"] },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "baidu", name: "百度文心", models: ["completions_pro", "completions"] },
  { id: "zhipuai", name: "智谱AI", models: ["glm-4v-plus", "glm-4-flash"] },
  { id: "tencent", name: "腾讯混元", models: ["hunyuan-vision", "hunyuan-pro"] },
  { id: "siliconflow", name: "SiliconFlow", models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"] },
  { id: "moonshot", name: "Moonshot", models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
]

const ModelConfig: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [modelId, setModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [configInfo, setConfigInfo] = useState<{ configured: boolean; provider: string | null; model_id: string | null } | null>(null)
  const [backendOnline, setBackendOnline] = useState(true)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [providersRes, configRes] = await Promise.all([
        modelConfigApi.getProviders(),
        modelConfigApi.getConfig(),
      ])
      setProviders(providersRes.providers)
      setConfigInfo(configRes)
      setBackendOnline(true)
      if (configRes.configured && configRes.provider && configRes.model_id) {
        setSelectedProvider(configRes.provider)
        setModelId(configRes.model_id)
      }
    } catch (e: any) {
      setBackendOnline(false)
      toast.showToast('无法连接到后端服务，使用本地厂商列表', 'error')
    }
  }

  const handleSave = async () => {
    if (!selectedProvider || !modelId || !apiKey) {
      setMessage('请填写厂商、模型 ID 和 API Key')
      return
    }
    setSaving(true)
    try {
      const res = await modelConfigApi.setConfig({
        provider: selectedProvider,
        model_id: modelId,
        api_key: apiKey,
        base_url: baseUrl || undefined,
      })
      api.setModelHeaders(selectedProvider, modelId, apiKey)
      setMessage('模型配置保存成功！')
      toast.showToast('模型配置保存成功！', 'success')
      setConfigInfo({ configured: true, provider: selectedProvider, model_id: modelId })
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message
      setMessage('保存失败: ' + errMsg)
      toast.showToast('保存失败: ' + errMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentProvider = providers.find(p => p.id === selectedProvider)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>🤖 模型配置</h2>

      {!backendOnline && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fff3cd',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 14,
          color: '#856404',
          border: '1px solid #ffc107',
        }}>
          ⚠️ 后端服务未连接，厂商列表使用本地缓存。请确保后端已启动。
        </div>
      )}

      {configInfo?.configured && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#e8f5e9',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 14,
          color: '#2e7d32',
        }}>
          ✅ 当前已配置: {configInfo.provider} / {configInfo.model_id}
        </div>
      )}

      {selectedProvider && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#b71c1c',
          backgroundColor: '#ffebee',
          border: '2px solid #ef5350',
          fontWeight: 500,
        }}>
          <strong>⚠️ 模型多模态能力警告</strong>
          <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 400, color: '#c62828' }}>
            当前选择的模型可能不具备多模态能力。若该模型不支持图像、音频、视频等非文本数据的处理，将导致以下功能不可用：
          </p>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, fontSize: 13, fontWeight: 400, color: '#c62828' }}>
            <li>上传图片格式的学习资料（PNG/JPG/GIF/BMP/WEBP）</li>
            <li>上传音频格式的学习资料（MP3/WAV/FLAC/AAC）</li>
            <li>上传视频格式的学习资料（MP4/AVI/MOV/MKV）</li>
            <li>解析文档中包含的图片内容</li>
          </ul>
          <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 400, color: '#c62828' }}>
            如果你需要处理上述格式的资料，请选择或输入具备多模态能力的模型（如 GPT-4o、Gemini 系列、通义千问 VL 系列等）。
          </p>
        </div>
      )}

      <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333' }}>厂商 (Provider)</label>
          <select
            value={selectedProvider}
            onChange={e => {
              setSelectedProvider(e.target.value)
              setModelId('')
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
              backgroundColor: '#fff',
              outline: 'none',
              transition,
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = colors.primary; e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}` }}
            onBlur={e => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none' }}
          >
            <option value="">选择厂商...</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333' }}>
            模型 ID <span style={{ fontWeight: 400, color: '#999' }}>(支持自定义输入，可从下拉建议中选择)</span>
          </label>
          <input
            list="model-suggestions"
            value={modelId}
            onChange={e => setModelId(e.target.value)}
            placeholder={currentProvider ? '输入或选择模型 ID...' : '请先选择厂商'}
            disabled={!currentProvider}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
              outline: 'none',
              transition,
              fontFamily: 'inherit',
              backgroundColor: currentProvider ? '#fff' : '#f5f5f5',
            }}
            onFocus={e => { if (currentProvider) { e.target.style.borderColor = colors.primary; e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}` } }}
            onBlur={e => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none' }}
          />
          {currentProvider && (
            <datalist id="model-suggestions">
              {currentProvider.models.map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333' }}>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="输入你的 API Key"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
              outline: 'none',
              transition,
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = colors.primary; e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}` }}
            onBlur={e => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333' }}>
            Base URL <span style={{ fontWeight: 400, color: '#999' }}>(可选)</span>
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="自定义 API 地址（兼容 OpenAI 格式时留空）"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
              outline: 'none',
              transition,
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = colors.primary; e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}` }}
            onBlur={e => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {message && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            backgroundColor: message.includes('成功') ? '#e8f5e9' : '#ffebee',
            color: message.includes('成功') ? '#2e7d32' : '#c62828',
          }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: radius.md,
            border: 'none',
            backgroundColor: colors.primary,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = colors.primaryHover }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.primary }}
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>

      <div style={{ marginTop: 24, backgroundColor: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>支持厂商一览</h3>
        {providers.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13 }}>暂无可用的厂商信息</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {providers.map(p => (
              <div key={p.id} style={{
                padding: '8px 12px',
                backgroundColor: '#f8f9fa',
                borderRadius: radius.sm,
                fontSize: 13,
                transition,
                border: `1px solid ${selectedProvider === p.id ? colors.primaryLight : 'transparent'}`,
              }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.primaryLight; e.currentTarget.style.borderColor = colors.primary }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = selectedProvider === p.id ? colors.primaryLight : '#f8f9fa'; e.currentTarget.style.borderColor = selectedProvider === p.id ? colors.primaryLight : 'transparent' }}
              >
                <strong>{p.name}</strong>
                <div style={{ color: colors.textSecondary, fontSize: 12 }}>{p.models.join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ModelConfig
