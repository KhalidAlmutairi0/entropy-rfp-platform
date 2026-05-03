/**
 * Shared TypeScript types for Entropy RFP Platform
 * Kept in sync with apps/api/schemas/ Pydantic models
 */

export type RFPStatus =
  | "UPLOADED"
  | "ANALYZING"
  | "ACTION_REQUIRED"
  | "DECISION_READY"
  | "DRAFTING"
  | "SUBMITTED"
  | "CLOSED";

export type DecisionType = "GO" | "NO_GO" | "REVIEW";

export type FlagType = "RED" | "GREEN";

export type FlagSeverity = "CRITICAL" | "MAJOR" | "MINOR";

export type UserRole =
  | "ADMIN"
  | "BD_MANAGER"
  | "PRE_SALES"
  | "PROPOSAL_WRITER"
  | "REVIEWER"
  | "READ_ONLY";

export type ProposalStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "EXPORTED";

export type KnowledgeDocType =
  | "PAST_PROPOSAL"
  | "COMPANY_PROFILE"
  | "CAPABILITY"
  | "PRICING_TEMPLATE"
  | "COMPLIANCE_DOC"
  | "REFERENCE"
  | "OTHER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  preferredLanguage: "ar" | "en";
  preferredTimezone: string;
  createdAt: string;
}

export interface RFPFile {
  id: string;
  rfpId: string;
  filename: string;
  fileType: "MAIN" | "ANNEX" | "CONTRACT" | "PRICING" | "OTHER";
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  pageCount: number | null;
  isOcrRequired: boolean;
  ocrConfidence: number | null;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
}

export interface RFP {
  id: string;
  titleAr: string | null;
  titleEn: string | null;
  agency: string | null;
  tenderNumber: string | null;
  language: "ar" | "en" | "bilingual";
  status: RFPStatus;
  deadline: string | null;
  estimatedValueSar: number | null;
  ownerId: string;
  fileCount: number;
  totalPages: number | null;
  ocrConfidence: number | null;
  fitScore: number | null;
  createdAt: string;
  updatedAt: string;
  files?: RFPFile[];
}

export interface ScoreBreakdown {
  technicalFit: number;
  businessFit: number;
  riskPenalty: number;
  capabilityMatch: number | null;
  staffingCapability: number | null;
  pastPerformance: number | null;
  pricingCompetitiveness: number | null;
  localContentCompliance: number | null;
  timelineRealism: number | null;
  financialStability: number | null;
  legalCompliance: number | null;
}

export interface Flag {
  id: string;
  decisionId: string;
  flagType: FlagType;
  severity: FlagSeverity | null;
  flagCode: string;
  titleAr: string;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  pageNumber: number | null;
  sectionName: string | null;
  evidenceQuote: string | null;
  isManual: boolean;
}

export interface Decision {
  id: string;
  rfpId: string;
  decisionType: DecisionType;
  totalScore: number;
  technicalFit: number;
  businessFit: number;
  riskPenalty: number;
  confidence: number;
  explanationAr: string | null;
  explanationEn: string | null;
  scoreBreakdown: ScoreBreakdown | null;
  isOverridden: boolean;
  overrideReason: string | null;
  overrideAt: string | null;
  flags: Flag[];
  createdAt: string;
  updatedAt: string;
}

export interface CitationRef {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  pageNumber: number | null;
}

export interface ProposalSection {
  id: string;
  proposalId: string;
  orderIndex: number;
  titleAr: string;
  titleEn: string | null;
  contentAr: string | null;
  contentEn: string | null;
  isAiGenerated: boolean;
  isLocked: boolean;
  confidence: number | null;
  hasUngroundedClaims: boolean;
  citationsJson: CitationRef[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  rfpId: string;
  templateId: string | null;
  status: ProposalStatus;
  currentVersion: number;
  approvedBy: string | null;
  outcome: "WON" | "LOST" | "CANCELLED" | "PENDING" | null;
  sections: ProposalSection[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  docType: KnowledgeDocType;
  language: "ar" | "en" | "bilingual";
  year: number | null;
  tags: string[];
  storagePath: string;
  isIndexed: boolean;
  embeddingModel: string | null;
  indexedAt: string | null;
  lastUsedAt: string | null;
  outcome: string | null;
  createdAt: string;
}

export interface TemplateSection {
  id: string;
  templateId: string;
  titleAr: string;
  titleEn: string | null;
  orderIndex: number;
  isRequired: boolean;
  defaultPrompt: string | null;
}

export interface Template {
  id: string;
  nameAr: string;
  nameEn: string | null;
  supportedLanguages: string[];
  projectTypes: string[] | null;
  usedCount: number;
  winCount: number;
  winRate: number | null;
  sections: TemplateSection[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  notificationType: string;
  titleAr: string;
  titleEn: string | null;
  bodyAr: string | null;
  bodyEn: string | null;
  deepLink: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface KPIs {
  totalRfps: number;
  totalRfpsDelta: number | null;
  winRate: number;
  winRateDelta: number | null;
  avgFitScore: number | null;
  avgFitScoreDelta: number | null;
  totalPipelineValue: number;
  decisionBreakdown: { go: number; review: number; no_go: number };
  scoreDistribution: Array<{ range: string; count: number }>;
}
