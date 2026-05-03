# Entropy RFP Intelligence Platform

Internal AI-powered platform for qualifying Saudi government RFPs and generating bid proposals.

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start all services
docker compose -f infra/docker-compose.yml up -d

# 3. Run database migrations
docker compose exec api alembic upgrade head

# 4. Access the app
open http://localhost:3000
```

Default admin credentials (change immediately):
- Email: `admin@entropy.sa`
- Password: set via `ADMIN_DEFAULT_PASSWORD` env var

## Architecture

```
entropy-rfp-platform/
├── apps/
│   ├── api/          # FastAPI backend (Python 3.11)
│   └── web/          # Next.js 14 frontend (TypeScript)
├── infra/
│   └── docker-compose.yml
├── packages/
│   ├── prompts/      # YAML prompt templates
│   ├── shared_types/ # TypeScript type definitions
│   └── eval/         # Evaluation harness
└── docs/
```

### Services

| Service   | Port  | Description                        |
|-----------|-------|------------------------------------|
| Web       | 3000  | Next.js frontend                   |
| API       | 8000  | FastAPI backend                    |
| Worker    | —     | Celery task queue                  |
| PostgreSQL| 5432  | Primary database                   |
| Redis     | 6379  | Cache + message broker             |
| Qdrant    | 6333  | Vector database                    |
| MinIO     | 9000  | Object storage (S3-compatible)     |

## Decision Engine

| Score    | Decision |
|----------|----------|
| ≥ 75     | **GO** — Proceed to proposal |
| 50 – 74  | **REVIEW** — BD Manager review required |
| < 50     | **NO_GO** — Do not bid |

Any CRITICAL red flag forces REVIEW regardless of score.

## User Roles

- **ADMIN** — Full system access
- **BD_MANAGER** — Decision overrides, weight adjustments
- **PRE_SALES** — Upload RFPs, view decisions
- **PROPOSAL_WRITER** — Edit proposal sections
- **REVIEWER** — Add comments, approve proposals
- **READ_ONLY** — View only

## Compliance

- Data residency: KSA only (no data leaves Saudi Arabia)
- Standards: NDMO, PDPL, SDAIA, CCC
- Audit log: All user actions are immutably logged

## Development

```bash
# API development
cd apps/api
python -m uvicorn main:app --reload

# Web development
cd apps/web
npm run dev

# Run evaluation suite
cd packages/eval
EVAL_API_TOKEN=<token> python evaluate.py
```

## Environment Variables

See `.env.example` for all required variables.

---

**Internal use only · Entropy.sa · Not for distribution**
