import axios, { AxiosInstance } from 'axios'

const API_BASE = '/api'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 120000,
    })
  }

  setModelHeaders(provider: string, modelId: string, apiKey: string) {
    this.client.defaults.headers.common['X-Provider'] = provider
    this.client.defaults.headers.common['X-Model-Id'] = modelId
    this.client.defaults.headers.common['X-Api-Key'] = apiKey
  }

  clearModelHeaders() {
    delete this.client.defaults.headers.common['X-Provider']
    delete this.client.defaults.headers.common['X-Model-Id']
    delete this.client.defaults.headers.common['X-Api-Key']
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const res = await this.client.get<T>(url, { params })
    return res.data
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const res = await this.client.post<T>(url, data)
    return res.data
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const res = await this.client.put<T>(url, data)
    return res.data
  }

  async delete<T>(url: string): Promise<T> {
    const res = await this.client.delete<T>(url)
    return res.data
  }

  async upload<T>(url: string, formData: FormData): Promise<T> {
    const res = await this.client.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  }
}

export const api = new ApiClient()
