// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  title?: string
  phone?: string
  isActive: boolean
  createdAt: string
  avatarUrl?: string
  preferredLanguage?: string
  preferredTimezone?: string
  notificationEmail?: boolean
  notificationSlack?: boolean
  mfaEnabled?: boolean
  lastActiveAt?: string
}

// ── RFP ───────────────────────────────────────────────────────────────────────

export interface RFPFile {
  id: string
  filename: string
  fileType: string
  mimeType?: string
  sizeBytes: number
  pageCount?: number
  storagePath: string
}

export interface RFP {
  id: string
  titleAr?: string
  titleEn?: string
  agency?: string
  tenderNumber?: string
  language: string
  status: string
  deadline?: string
  estimatedValueSar?: number
  deckStatus?: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED'
  deckPdfPath?: string
  ownerId: string
  uploadedByName?: string
  createdAt: string
  files: RFPFile[]
}

export interface PaginatedRFPs {
  items: RFP[]
  total: number
  page: number
  pageSize: number
}

// ── Decision ──────────────────────────────────────────────────────────────────

export interface Flag {
  id: string
  flagType: 'RED' | 'GREEN'
  severity?: string
  flagCode?: string
  titleEn?: string
  titleAr?: string
  descriptionEn?: string
  descriptionAr?: string
  evidenceQuote?: string
  pageNumber?: number
  sectionName?: string
}

export interface Decision {
  id: string
  rfpId: string
  decisionType: 'GO' | 'REVIEW' | 'NO_GO'
  totalScore: number
  technicalFit: number
  businessFit: number
  riskPenalty: number
  confidence: number
  capabilityMatchScore?: number
  explanationEn?: string
  explanationAr?: string
  sectionsNeedingReview?: string
  flags: Flag[]
  createdAt: string
}

// ── Proposal ──────────────────────────────────────────────────────────────────

export interface ProposalSection {
  id: string
  proposalId: string
  orderIndex: number
  titleAr?: string
  titleEn?: string
  contentAr?: string
  contentEn?: string
  isLocked: boolean
  isAiGenerated: boolean
  confidence?: number
  wordCount: number
  hasUngroundedClaims?: boolean
}

export interface Proposal {
  id: string
  rfpId: string
  status: string
  outcome?: string
  outcomeNotes?: string
  createdAt: string
  sections: ProposalSection[]
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

export interface KnowledgeDoc {
  id: string
  title: string
  docType: string
  language: string
  storagePath: string
  sizeBytes: number
  isIndexed: boolean
  outcome?: string
  createdAt: string
  indexedAt?: string
}

export interface KnowledgeStats {
  total: number
  indexed: number
  byType: Record<string, number>
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface TemplateSection {
  id: string
  templateId: string
  titleAr?: string
  titleEn?: string
  orderIndex: number
  isLocked: boolean
  wordCountTarget?: number
  aiInstructions?: string
}

export interface Template {
  id: string
  nameAr: string
  nameEn: string
  supportedLanguages: string[]
  projectTypes?: string[]
  sections: TemplateSection[]
  createdAt: string
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  type: string
  titleEn?: string
  titleAr?: string
  bodyEn?: string
  bodyAr?: string
  isRead: boolean
  createdAt: string
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserListItem {
  id: string
  email: string
  name: string
  role: string
  title?: string
  isActive: boolean
  createdAt: string
  lastActiveAt?: string
}

export interface PaginatedUsers {
  items: UserListItem[]
  total: number
  page: number
  pageSize: number
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  userId?: string
  userEmail?: string
  action: string
  targetType?: string
  targetId?: string
  ipAddress?: string
  createdAt: string
}

export interface PaginatedAudit {
  items: AuditLog[]
  total: number
  page: number
  pageSize: number
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface KpiData {
  totalRfps: number
  activeRfps: number
  decisionReady: number
  goCount: number
  reviewCount: number
  noGoCount: number
  winRate: number
  decisions: number
}

export interface ChartPoint {
  period: string
  count: number
  goCount?: number
  reviewCount?: number
  noGoCount?: number
}
