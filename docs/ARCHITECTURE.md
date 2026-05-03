# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (RTL/AR)                        │
│                    Next.js 14 + TypeScript                      │
│             SWR · TipTap · Recharts · react-dropzone            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / SSE
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI (Python 3.11)                         │
│          JWT Auth · Keycloak SSO · RBAC (6 roles)               │
│          Routers: rfp, decision, proposal, knowledge,           │
│          analytics, auth, users, audit, notifications            │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐
│ PostgreSQL  │  │   Redis 7       │  │  MinIO     │
│ (primary DB)│  │ (cache + pubsub │  │ (file store│
│             │  │  + Celery broker│  │  presigned │
└─────────────┘  └────────┬────────┘  │  URLs)     │
                          │           └────────────┘
              ┌───────────▼────────────┐
              │   Celery Workers       │
              │ ┌─────────────────┐    │
              │ │ Ingestion Queue │    │
              │ │ validate→OCR→   │    │
              │ │ classify→embed→ │    │
              │ │ score→decision  │    │
              │ └─────────────────┘    │
              │ ┌─────────────────┐    │
              │ │ Indexing Queue  │    │
              │ │ KB doc→embed→   │    │
              │ │ Qdrant upsert   │    │
              │ └─────────────────┘    │
              │ ┌─────────────────┐    │
              │ │ Export Queue    │    │
              │ │ DOCX/PDF gen    │    │
              │ └─────────────────┘    │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │      Qdrant v1.8       │
              │   Collections:         │
              │   - rfp_chunks         │
              │   - knowledge_base     │
              │   - company_profile    │
              │   HNSW · 1024-dim      │
              └────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │    AI Services         │
              │  ┌──────────────────┐  │
              │  │ Claude (primary) │  │
              │  │ GPT-4o (backup)  │  │
              │  └──────────────────┘  │
              │  ┌──────────────────┐  │
              │  │ Cohere Embed v3  │  │
              │  │ Multilingual     │  │
              │  │ 1024-dim         │  │
              │  └──────────────────┘  │
              └────────────────────────┘
```

## Ingestion Pipeline

```
Upload → Validate → OCR (Azure/Tesseract) → Parse
  → Section Classification → Entity Extraction
  → Flag Detection (RED/GREEN)
  → Chunking (600 tok, 100 overlap)
  → Embedding (Cohere batch-96)
  → Qdrant Upsert
  → Score Computation
  → Decision Record Creation
  → SSE Events → Browser
```

## Scoring Formula

```
Total Score = Technical Fit (0-40) + Business Fit (0-30) - Risk Penalty (0-30)

Technical Fit (40pts):
  - Capability Match:        0-15
  - Staffing Capability:     0-10
  - Past Performance:        0-10
  - Technology Stack Match:  0-5

Business Fit (30pts):
  - Pricing Competitiveness: 0-10
  - Strategic Alignment:     0-10
  - Local Content:           0-5
  - Timeline Realism:        0-5

Risk Penalty (0-30):
  - Per CRITICAL flag:  -15
  - Per MAJOR flag:     -8
  - Per MINOR flag:     -3
  (capped at 30)

Decision Thresholds:
  ≥ 75 → GO
  50-74 → REVIEW
  < 50  → NO_GO
  Any CRITICAL flag → forces REVIEW
```

## RAG Pipeline

```
Query → Dense Embedding (Cohere) + BM25 (Elasticsearch-style)
  → Hybrid Retrieval from Qdrant (RRF reranking)
  → Cross-Encoder Reranking (top-20 → top-5)
  → Context Assembly with [SOURCE:id] references
  → LLM Generation (Claude)
  → Citation Extraction + Grounding Check
```

## Hallucination Prevention

1. All LLM prompts mandate `[SOURCE:chunk_id]` inline citations
2. Post-generation parser extracts citations
3. Claims without citations flagged as `has_ungrounded_claims = True`
4. Export blocked if ungrounded claims exist (configurable)
5. Frontend highlights ungrounded claims in yellow

## Data Flow Security

- JWT tokens: 24h expiry, RS256
- Keycloak SSO: primary auth for production
- RBAC: 6 roles with 14 granular permissions
- All file access via MinIO presigned URLs (15-min expiry)
- Audit log: immutable append-only, all actions logged
- Soft deletes only: data never physically deleted
