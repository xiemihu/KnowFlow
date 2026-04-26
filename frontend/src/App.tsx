import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import SubjectList from './pages/SubjectList'
import SubjectLayout from './pages/SubjectLayout'
import SubjectDetail from './pages/SubjectDetail'
import ModelConfig from './pages/ModelConfig'
import Chat from './pages/Chat'
import Quiz from './pages/Quiz'
import Review from './pages/Review'
import KnowledgeGraph from './pages/KnowledgeGraph'
import { modelConfigApi } from './api/subjects'
import { api } from './api/client'

const ProtectedRoutes: React.FC = () => {
  const [configChecked, setConfigChecked] = useState(false)
  const [hasConfig, setHasConfig] = useState(false)
  const location = useLocation()

  useEffect(() => {
    modelConfigApi.getConfig().then(res => {
      const configured = res.configured && res.provider && res.model_id
      setHasConfig(!!configured)
      if (configured && res.provider && res.model_id) {
        api.setModelHeaders(res.provider, res.model_id, '')
      }
      setConfigChecked(true)
    }).catch(() => {
      setHasConfig(false)
      setConfigChecked(true)
    })
  }, [])

  if (!configChecked) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>加载中...</div>
  }

  if (!hasConfig && location.pathname !== '/model-config') {
    return <Navigate to="/model-config" replace />
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/subjects" replace />} />
        <Route path="subjects" element={<SubjectList />} />
        <Route path="subjects/:id" element={<SubjectLayout />}>
          <Route index element={<SubjectDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="review" element={<Review />} />
          <Route path="knowledge" element={<KnowledgeGraph />} />
        </Route>
        <Route path="model-config" element={<ModelConfig />} />
      </Route>
    </Routes>
  )
}

const App: React.FC = () => {
  return <ProtectedRoutes />
}

export default App
