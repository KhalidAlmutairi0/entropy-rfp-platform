import type {
  AuthResponse, User, RFP, PaginatedRFPs, Decision, Proposal,
  KnowledgeDoc, KnowledgeStats, Template, Notification,
  PaginatedUsers, UserListItem, PaginatedAudit, KpiData, ChartPoint,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('entropy_token')
}

export function setToken(token: string) {
  localStorage.setItem('entropy_token', token)
}

export function clearToken() {
  localStorage.removeItem('entropy_token')
  localStorage.removeItem('entropy_user')
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<T> {
  let token: string | null = null
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (!skipAuth) {
    token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {}
    throw new Error(detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true),

  signup: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }, true),

  me: () => request<User>('/auth/me'),

  updateMe: (data: {
    name?: string
    title?: string
    phone?: string
    notification_email?: boolean
    notification_slack?: boolean
    preferred_language?: string
    preferred_timezone?: string
  }) => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// ── RFPs ──────────────────────────────────────────────────────────────────────

// The backend returns flags split into redFlags/greenFlags and scores nested under breakdown.
// Normalize to the flat Decision shape the frontend expects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDecision(raw: any): Decision {
  const breakdown = raw.breakdown ?? {}
  return {
    ...raw,
    flags: [...(raw.redFlags ?? []), ...(raw.greenFlags ?? [])],
    technicalFit: breakdown.technicalFit ?? 0,
    businessFit: breakdown.businessFit ?? 0,
    riskPenalty: breakdown.riskPenalty ?? 0,
    capabilityMatchScore: breakdown.capabilityMatch,
  } as Decision
}

export const rfps = {
  list: (params?: { page?: number; pageSize?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('page_size', String(params.pageSize))
    if (params?.search) q.set('search', params.search)
    if (params?.status) q.set('status', params.status)
    return request<PaginatedRFPs>(`/rfps?${q}`)
  },

  get: (id: string) => request<RFP>(`/rfps/${id}`),

  upload: (formData: FormData) =>
    request<RFP>('/rfps/upload', { method: 'POST', body: formData }),

  update: (id: string, data: Partial<Pick<RFP, 'titleAr' | 'titleEn' | 'agency' | 'tenderNumber' | 'deadline' | 'estimatedValueSar'>>) =>
    request<RFP>(`/rfps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<void>(`/rfps/${id}`, { method: 'DELETE' }),

  analyze: (id: string) =>
    request<{ taskId: string }>(`/rfps/${id}/analyze`, { method: 'POST' }),

  decision: (id: string) =>
    request<Record<string, unknown>>(`/rfps/${id}/decision`).then(normalizeDecision),

  overrideDecision: (id: string, decisionType: string, reason?: string) =>
    request<Record<string, unknown>>(`/rfps/${id}/decision/override`, {
      method: 'POST',
      body: JSON.stringify({ decision_type: decisionType, reason }),
    }).then(normalizeDecision),

  suggestAgenda: (id: string) =>
    request<{ sections: unknown[]; basis: string }>(`/rfps/${id}/suggest-agenda`),

  createProposal: (id: string, mode?: string) =>
    request<Proposal>(`/rfps/${id}/proposal`, {
      method: 'POST',
      body: JSON.stringify({ mode: mode ?? 'AI', use_ai_agenda: true }),
    }),

  getProposal: (id: string) => request<Proposal>(`/rfps/${id}/proposal`),

  updateOutcome: (id: string, outcome: string, notes?: string) =>
    request<Proposal>(`/rfps/${id}/proposal/outcome`, {
      method: 'PATCH',
      body: JSON.stringify({ outcome, notes }),
    }),

  generateDeck: (id: string) =>
    request<{ taskId: string; status: string }>(`/rfps/${id}/generate-deck`, { method: 'POST' }),

  downloadDeck: (id: string) =>
    fetch(`${BASE}/rfps/${id}/deck`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }),

  exportProposal: (id: string, config?: {
    format?: string
    include_cover?: boolean
    include_toc?: boolean
    include_section_numbers?: boolean
    include_watermark?: boolean
    branding?: string
    language?: string
  }) =>
    request<{ taskId: string; status: string }>(`/rfps/${id}/proposal/export`, {
      method: 'POST',
      body: JSON.stringify({
        format: config?.format ?? 'pdf',
        include_cover: config?.include_cover ?? true,
        include_toc: config?.include_toc ?? true,
        include_section_numbers: config?.include_section_numbers ?? true,
        include_watermark: config?.include_watermark ?? false,
        branding: config?.branding ?? 'default',
        language: config?.language ?? 'ar',
      }),
    }),
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

export const knowledge = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('page_size', String(params.pageSize))
    if (params?.search) q.set('search', params.search)
    return request<{ items: KnowledgeDoc[]; total: number }>(`/knowledge?${q}`)
  },

  get: (id: string) => request<KnowledgeDoc>(`/knowledge/${id}`),

  stats: () => request<KnowledgeStats>('/knowledge/stats'),

  upload: (formData: FormData) =>
    request<KnowledgeDoc>('/knowledge/upload', { method: 'POST', body: formData }),

  reindex: (id: string) =>
    request<{ message: string }>(`/knowledge/${id}/reindex`, { method: 'POST' }),
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const templates = {
  list: () => request<{ items: Template[]; total: number }>('/templates'),

  get: (id: string) => request<Template>(`/templates/${id}`),

  create: (data: {
    nameAr: string
    nameEn: string
    supportedLanguages: string[]
    projectTypes?: string[]
    sections?: unknown[]
  }) => request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),

  delete: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = {
  list: () => request<{ items: Notification[]; total: number }>('/notifications'),

  markRead: (id: string) =>
    request<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    request<{ message: string }>('/notifications/read-all', { method: 'PATCH' }),
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = {
  list: (params?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('page_size', String(params.pageSize))
    return request<PaginatedUsers>(`/users?${q}`)
  },

  get: (id: string) => request<UserListItem>(`/users/${id}`),

  create: (data: { name: string; email: string; password: string; role: string; title?: string }) =>
    request<UserListItem>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateRole: (id: string, role: string) =>
    request<UserListItem>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  deactivate: (id: string) =>
    request<UserListItem>(`/users/${id}/deactivate`, { method: 'PATCH' }),
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export const audit = {
  list: (params?: { page?: number; pageSize?: number; action?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('page_size', String(params.pageSize))
    if (params?.action) q.set('action', params.action)
    return request<PaginatedAudit>(`/audit?${q}`)
  },

  exportCsv: () =>
    fetch(`${BASE}/audit/export/csv`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }),
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analytics = {
  kpis: (days = 90) => request<KpiData>(`/analytics/kpis?days=${days}`),

  decisionsOverTime: (days = 90) =>
    request<{ rows: ChartPoint[] }>(`/analytics/charts/decisions-over-time?days=${days}`),

  winRateByType: () =>
    request<{ rows: unknown[] }>(`/analytics/charts/win-rate-by-type`),
}

// ── Direct Proposal ───────────────────────────────────────────────────────────

export const proposals = {
  createDirect: (data: {
    title: string
    useAiAgenda?: boolean
    templateId?: string
  }) =>
    request<Proposal>('/proposals/direct', {
      method: 'POST',
      body: JSON.stringify({ title: data.title, use_ai_agenda: data.useAiAgenda ?? true, template_id: data.templateId }),
    }),
}
