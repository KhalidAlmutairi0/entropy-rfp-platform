import axios, { AxiosError, type AxiosInstance } from "axios";
import { removeToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      removeToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token?: string; expires_in?: number; mfa_required?: boolean; session_token?: string }>("/auth/login", { email, password }),
  signup: (name: string, email: string, password: string) =>
    api.post<{ access_token: string; expires_in: number }>("/auth/signup", { name, email, password }),
  verifyMfa: (sessionToken: string, code: string) =>
    api.post<{ access_token: string; expires_in: number }>("/auth/mfa/verify", { session_token: sessionToken, code }),
  exchangeSsoCode: (code: string) =>
    api.post<{ access_token: string; expires_in: number }>("/auth/sso/exchange", { code }),
  refresh: () =>
    api.post<{ access_token: string; expires_in: number }>("/auth/refresh"),
  logout: () => api.post("/auth/logout"),
};

export const rfpApi = {
  list: (params?: Record<string, unknown>) => api.get("/rfps", { params }),
  upload: (formData: FormData) =>
    api.post("/rfps/upload", formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }),
  get: (id: string) => api.get(`/rfps/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/rfps/${id}`, data),
  delete: (id: string) => api.delete(`/rfps/${id}`),
  analyze: (id: string) => api.post(`/rfps/${id}/analyze`),
  generateDeck: (id: string, templateFile?: File) => {
    if (templateFile) {
      const form = new FormData();
      form.append("template_file", templateFile);
      return api.post(`/rfps/${id}/generate-deck`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post(`/rfps/${id}/generate-deck`);
  },
  downloadDeck: (id: string) => api.get(`/rfps/${id}/deck`, { responseType: "blob" }),
};

export const decisionApi = {
  get: (rfpId: string) => api.get(`/rfps/${rfpId}/decision`),
  override: (rfpId: string, newDecision: string, reason: string) =>
    api.post(`/rfps/${rfpId}/decision/override`, { new_decision: newDecision, reason }),
  adjustWeights: (rfpId: string, weights: { technical_weight: number; business_weight: number; risk_weight: number }) =>
    api.put(`/rfps/${rfpId}/decision/weights`, weights),
  addEvidence: (rfpId: string, data: Record<string, unknown>) =>
    api.post(`/rfps/${rfpId}/decision/evidence`, data),
};

export interface SectionDef {
  title_en: string;
  title_ar: string;
  is_locked?: boolean;
}

export interface AgendaSuggestion {
  sections: SectionDef[];
  basis: "template" | "rfp_analysis" | "default";
  matched_capabilities: string[];
}

export interface DirectProposalCreate {
  title: string;
  description?: string;
  template_id?: string;
  custom_sections?: SectionDef[];
  use_ai_agenda?: boolean;
}

export const proposalApi = {
  create: (rfpId: string, data?: { template_id?: string; mode?: string; custom_sections?: SectionDef[]; use_ai_agenda?: boolean }) =>
    api.post(`/rfps/${rfpId}/proposal`, data ?? {}),
  get: (rfpId: string) => api.get(`/rfps/${rfpId}/proposal`),
  suggestAgenda: (rfpId: string) => api.get<AgendaSuggestion>(`/rfps/${rfpId}/proposal/suggest-agenda`),
  createDirect: (data: DirectProposalCreate) => api.post("/proposals/direct", data),
  updateSection: (rfpId: string, sectionId: string, data: Record<string, unknown>) =>
    api.put(`/rfps/${rfpId}/proposal/sections/${sectionId}`, data),
  export: (rfpId: string, config: Record<string, unknown>) =>
    api.post(`/rfps/${rfpId}/proposal/export`, config),
  updateOutcome: (rfpId: string, outcome: string, notes?: string) =>
    api.patch(`/rfps/${rfpId}/proposal/outcome`, { outcome, notes }),
};

export const knowledgeApi = {
  list: (params?: Record<string, unknown>) => api.get("/knowledge", { params }),
  upload: (formData: FormData) =>
    api.post("/knowledge/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  stats: () => api.get("/knowledge/stats"),
  reindex: (id: string) => api.post(`/knowledge/${id}/reindex`),
};

export const notificationApi = {
  list: (params?: Record<string, unknown>) => api.get("/notifications", { params }),
  markAllRead: () => api.patch("/notifications/read-all"),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
};

export const analyticsApi = {
  kpis: (days?: number) => api.get<{
    period_days: number;
    pipeline: { active: number; by_status: Record<string, number> };
    decisions: { total: number; go: number; no_go: number; review: number };
    outcomes: { won: number; lost: number; win_rate: number };
  }>("/analytics/kpis", { params: { days } }),
  chartWinRateByType: () => api.get("/analytics/charts/win-rate-by-project-type"),
  chartDecisionsOverTime: (days?: number) => api.get("/analytics/charts/decisions-over-time", { params: { days } }),
};

export const usersApi = {
  list: (params?: Record<string, unknown>) => api.get("/users", { params }),
  create: (data: Record<string, unknown>) => api.post("/users", data),
  get: (id: string) => api.get(`/users/${id}`),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
};

export const auditApi = {
  list: (params?: Record<string, unknown>) => api.get("/audit", { params }),
  exportCsv: () => api.get("/audit/export", { responseType: "blob" }),
};
