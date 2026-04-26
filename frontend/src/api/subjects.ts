import { api } from './client'

export interface Subject {
  id: string
  name: string
  description: string
  created_at: string
  last_active_at: string
  resource_count: number
  kp_count: number
  group_count: number
  interaction_count: number
}

export interface SubjectListResponse {
  subjects: Subject[]
}

export interface Resource {
  id: string
  subject_id: string
  filename: string
  file_type: string
  file_size: number
  status: string
  error_message: string | null
  created_at: string
}

export interface ResourceListResponse {
  resources: Resource[]
}

export interface KnowledgePointItem {
  id: string
  name: string
  description: string
  mastery: number
  resource_count: number
  parent_id: string | null
}

export interface KnowledgeListResponse {
  knowledge_points: KnowledgePointItem[]
}

export interface SourceChunk {
  id: string
  content: string
  filename: string
}

export interface LinkedExercise {
  id: string
  question: string
  difficulty: string
  question_type: string
}

export interface KnowledgePointDetail {
  id: string
  name: string
  description: string
  mastery: number
  group_id: string | null
  is_important: boolean
  is_difficult: boolean
  sources: SourceChunk[]
  exercises: LinkedExercise[]
}

export interface ChatResponse {
  answer: string
  message_id?: string
  conversation_id?: string
}

export interface ChatHistoryResponse {
  messages: { id: string; role: string; content: string; created_at: string }[]
}

export interface QuizItem {
  id: string
  type: string
  question: string
  options: string[] | null
  answer: string
  explanation: string
  kp_id: string
  kp_name: string
}

export interface QuizBatchResponse {
  exercises: QuizItem[]
  total: number
}

export interface GradeResponse {
  is_correct: boolean
  correct_answer: string
  explanation: string
  kp_id: string
  kp_name: string
  grading_detail: any | null
}

export interface ReviewPlanResponse {
  total_knowledge_points: number
  average_mastery: number
  mastered: number
  learning: number
  weak: number
  today_review: { id: string; name: string; mastery: number; urgency: number }[]
}

export interface ReviewGuideResponse {
  guide: string
  remaining: number
  current_kps: { id: string; name: string; mastery: number }[]
  total_weak: number
}

export interface ProviderInfo {
  id: string
  name: string
  models: string[]
}

export interface ProvidersResponse {
  providers: ProviderInfo[]
}

export interface ModelConfigInfo {
  configured: boolean
  provider: string | null
  model_id: string | null
}

export interface KnowledgeGroup {
  id: string
  subject_id: string
  name: string
  description: string
  sort_order: number
  kp_count: number
  created_at: string
}

export interface KnowledgeGroupListResponse {
  groups: KnowledgeGroup[]
}

export interface KnowledgeGroupTreeItem {
  id: string
  name: string
  description: string
  sort_order: number
  kp_count: number
  knowledge_points: { id: string; name: string; description: string; mastery: number }[]
}

export interface KnowledgeGroupTreeResponse {
  groups: KnowledgeGroupTreeItem[]
  ungrouped: { id: string; name: string; description: string; mastery: number }[]
}

export interface ExerciseItem {
  id: string
  subject_id: string
  question: string
  answer: string
  explanation: string
  difficulty: string
  question_type: string
  options: string | null
  source: string
  is_correct: boolean
  kp_ids: string[]
  kp_names: string[]
  created_at: string
}

export interface ExerciseListResponse {
  exercises: ExerciseItem[]
}

export const subjectApi = {
  list: () => api.get<SubjectListResponse>('/subjects'),
  get: (id: string) => api.get<Subject>(`/subjects/${id}`),
  create: (data: { name: string; description?: string }) => api.post<Subject>('/subjects', data),
  update: (id: string, data: { name?: string; description?: string }) => api.put<Subject>(`/subjects/${id}`, data),
  delete: (id: string) => api.delete<void>(`/subjects/${id}`),
}

export const resourceApi = {
  listBySubject: (subjectId: string) => api.get<ResourceListResponse>(`/resources/subject/${subjectId}`),
  upload: (subjectId: string, file: File) => {
    const form = new FormData()
    form.append('subject_id', subjectId)
    form.append('file', file)
    return api.upload<Resource>('/resources/upload', form)
  },
  delete: (resourceId: string) => api.delete<void>(`/resources/${resourceId}`),
}

export const chatApi = {
  send: (subjectId: string, query: string, conversationId?: string) =>
    api.post<ChatResponse>('/chat', { subject_id: subjectId, query, history: [], conversation_id: conversationId }),
  history: (subjectId: string, conversationId?: string) => {
    const params: any = {}
    if (conversationId) params.conversation_id = conversationId
    return api.get<ChatHistoryResponse>(`/chat/history/${subjectId}`, params)
  },
}

export const conversationApi = {
  list: (subjectId: string) => api.get<{ conversations: any[] }>(`/conversations/subject/${subjectId}`),
  create: (subjectId: string, title?: string) => api.post<any>(`/conversations/subject/${subjectId}?title=${title || '新对话'}`),
  rename: (convId: string, title: string) => api.put<any>(`/conversations/${convId}?title=${encodeURIComponent(title)}`),
  delete: (convId: string) => api.delete<void>(`/conversations/${convId}`),
}

export const knowledgeApi = {
  list: (subjectId: string) => api.get<KnowledgeListResponse>(`/knowledge/list/${subjectId}`),
  detail: (kpId: string) => api.get<KnowledgePointDetail>(`/knowledge/detail/${kpId}`),
  search: (subjectId: string, q: string) => api.get<any[]>(`/knowledge/search/${subjectId}`, { q }),
  update: (kpId: string, data: { name?: string; description?: string; is_important?: boolean; is_difficult?: boolean }) =>
    api.put<{ id: string; name: string; description: string; is_important: boolean; is_difficult: boolean }>(`/knowledge/point/${kpId}`, data),
  deletePoint: (kpId: string) => api.delete<void>(`/knowledge/point/${kpId}`),
  batchDelete: (kpIds: string[]) => api.post<void>('/knowledge/batch-delete', { kp_ids: kpIds }),
  deleteAll: (subjectId: string) => api.delete<void>(`/knowledge/subject/${subjectId}`),
  moveToGroup: (kpId: string, groupId: string) => api.post<void>(`/knowledge/point/${kpId}/move/${groupId}`),
}

export const groupApi = {
  list: (subjectId: string) => api.get<KnowledgeGroupListResponse>(`/groups/subject/${subjectId}`),
  create: (subjectId: string, data: { name: string; description?: string }) =>
    api.post<KnowledgeGroup>(`/groups/subject/${subjectId}`, data),
  update: (groupId: string, data: { name?: string; description?: string }) =>
    api.put<KnowledgeGroup>(`/groups/${groupId}`, data),
  delete: (groupId: string) => api.delete<void>(`/groups/${groupId}`),
  tree: (subjectId: string) => api.get<KnowledgeGroupTreeResponse>(`/groups/tree/${subjectId}`),
  autoGroup: (subjectId: string) => api.post<{ groups_created: number; total_kps: number; merged: number; empty_deleted: number }>(`/groups/auto-group/${subjectId}`),
}

export const exerciseApi = {
  getDetail: (exerciseId: string) => api.get<ExerciseItem>(`/exercises/${exerciseId}`),
  listBySubject: (subjectId: string, kpId?: string) => {
    const params: any = {}
    if (kpId) params.kp_id = kpId
    return api.get<ExerciseListResponse>(`/exercises/subject/${subjectId}`, params)
  },
  save: (data: {
    subject_id: string; question: string; answer?: string; explanation?: string;
    difficulty?: string; question_type?: string; options?: string[]; kp_ids?: string[]
  }) => api.post<ExerciseItem>('/exercises/save', data),
  delete: (exerciseId: string) => api.delete<void>(`/exercises/${exerciseId}`),
}

export const quizApi = {
  generateBatch: (subjectId: string, count: number = 3, difficulty: string = 'medium', promptHint: string = '', questionTypes: string[] = []) =>
    api.post<QuizBatchResponse>('/quiz/generate-batch', {
      subject_id: subjectId, count, difficulty, prompt_hint: promptHint, question_types: questionTypes,
    }),
  grade: (exerciseId: string, userAnswer: string) =>
    api.post<GradeResponse>('/quiz/grade', { exercise_id: exerciseId, user_answer: userAnswer }),
}

export const reviewApi = {
  plan: (subjectId: string) => api.get<ReviewPlanResponse>(`/review/plan/${subjectId}`),
  guide: (subjectId: string) => api.get<ReviewGuideResponse>(`/review/guide/${subjectId}`),
}

export const modelConfigApi = {
  getProviders: () => api.get<ProvidersResponse>('/model-config/providers'),
  getConfig: () => api.get<ModelConfigInfo>('/model-config'),
  setConfig: (data: { provider: string; model_id: string; api_key: string; base_url?: string }) =>
    api.post<{ id: string; provider: string; model_id: string; is_active: boolean }>('/model-config', data),
}
