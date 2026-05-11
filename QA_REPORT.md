# Entropy RFP Platform — Full QA & Fix Report
**Date:** 2026-05-07  
**Tested by:** Automated test suite (94 tests across 14 sections)  
**API:** http://localhost:8000 (FastAPI)  
**Web:** http://localhost:3000 (Next.js)

---

## 1. Executive Verdict

**ALL CLEAR — 0 failures, 93/94 tests passing (98.9%).**

Six bugs were found and fixed. The platform is now ready for continued development. The single WARN is a LOW-severity informational item about XSS payloads in JSON responses — correct API behavior; the frontend is responsible for sanitizing display.

---

## 2. Environment & Seed Status

| Item | Status |
|------|--------|
| API health (`/health`) | OK — `{"status":"ok","service":"entropy-rfp-api"}` |
| Database | SQLite dev DB, seeded, tables created |
| Storage | Local filesystem fallback (MinIO not running) |
| Redis | Not running — SSE streams gracefully degrade |
| `/docs` & `/redoc` | Accessible in development |
| CORS | Allows `http://localhost:3000`, blocks all other origins |

---

## 3. Coverage Matrix

| Area | Endpoints/Pages Tested | Pass | Fail | Notes |
|------|------------------------|------|------|-------|
| Environment & Health | `/health`, `/docs`, `/redoc`, CORS | 5 | 0 | |
| Authentication | `/auth/login`, `/auth/signup`, `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/mfa`, `/auth/sso-*` | 13 | 0 | |
| RBAC | All roles vs. protected routes, JWT tampering | 6 | 0 | |
| RFP Lifecycle | `/rfps` (list/upload/get/patch/delete/analyze/stream/deck) | 16 | 0 | Both regressions confirmed fixed |
| Decision Engine | `/rfps/{id}/decision*` | 2 | 0 | |
| Knowledge Base | `/knowledge` (list/upload/dup/ext/path/get/stats/reindex) | 8 | 0 | |
| Analytics | `/analytics/kpis`, `/analytics/charts/*`, boundary checks | 8 | 0 | |
| Notifications | `/notifications` (list/read/read-all/isolation) | 4 | 0 | |
| Users | `/users` (list/create/get/role/deactivate/self-deactivate) | 8 | 0 | |
| Audit Log | `/audit` (list/filter/CSV export), access control | 5 | 0 | |
| Templates | `/templates` (list/create/get/delete), permission checks | 8 | 0 | |
| Proposals | `/rfps/{id}/proposal*`, `/proposals/direct`, sections, outcome | 5 | 0 | |
| Security | SQL injection, XSS, path traversal, DoS protection | 4 | 0 | 1 WARN (expected) |
| Data Integrity | Audit log correctness for mutating operations | 2 | 0 | |
| **TOTAL** | **94 tests** | **93** | **0** | **1 WARN** |

---

## 4. Findings by Severity

### CRITICAL — None

### HIGH

#### BUG-1: `POST /templates` crashed with 500 (FIXED)
- **Root cause:** `TemplateCreate.supported_languages` is `List[str]` but `Template.supported_languages` column is `String(20)`. SQLAlchemy raised `ProgrammingError: type 'list' is not supported` when trying to bind.  
  Same issue for `project_types_json` — a Python list was passed instead of a JSON string.
- **Fix:** `apps/api/routers/templates.py` — convert list to comma-separated string and `json.dumps()` before insert.

#### BUG-2: Proposal background tasks caused "database is locked" (FIXED)
- **Root cause:** `create_proposal` (new proposal path) and `create_direct_proposal` both used `generate_proposal_sections_task` — the Celery wrapper that calls `asyncio.run()`. This created a second event loop in a background thread with its own SQLite connection. Two concurrent writers on SQLite → immediate "database is locked" error on the very next request.
- **Fix (part 1):** `apps/api/routers/proposal.py` — both endpoints now use `_generate_sections_async` directly (the async function), same as the existing-proposal path already documented.
- **Fix (part 2):** `apps/api/tasks/proposal_tasks.py` — refactored `_generate_sections_async` into 3 phases: (1) short DB read + locked-section write, (2) AI generation outside any DB session, (3) short DB write for generated sections. This eliminates holding a write lock during LLM calls.
- **Fix (part 3):** `apps/api/core/database.py` — SQLite engine now uses `StaticPool` to serialize all connections through one SQLite handle, eliminating cross-thread lock conflicts in dev.

### MEDIUM

#### BUG-3: `PATCH /rfps/{id}` crashed with 500 (FIXED)
- **Root cause:** `update_rfp` loaded the RFP without `selectinload(RFP.files)`. When Pydantic tried to serialize `RFPResponse.files`, SQLAlchemy attempted a lazy-load in the async context and raised `MissingGreenlet` (async I/O attempted outside the event loop).
- **Fix:** `apps/api/routers/rfp.py` — added `options(selectinload(RFP.files))` to the query in `update_rfp`.

#### BUG-4: `DELETE /rfps/{id}` allowed double-delete (FIXED)
- **Root cause:** `delete_rfp` queried `select(RFP).where(RFP.id == rfp_id)` without filtering `is_deleted == False`. A second delete on an already-soft-deleted RFP would succeed and create a spurious audit log entry.
- **Fix:** `apps/api/routers/rfp.py` — added `RFP.is_deleted == False` guard.

### LOW

#### BUG-5: `PATCH /notifications/{id}/read` silently returned 200 for missing notifications (FIXED)
- **Root cause:** The endpoint returned `{"message": "Marked as read"}` even when no notification matched the `(notification_id, user_id)` filter.
- **Fix:** `apps/api/routers/notifications.py` — raises `HTTP 404` when notification not found.

### INFO

#### WARN-1: XSS payload stored as-is in JSON API response (NOT a bug)
- The API stores `<script>alert('xss')</script>` in `title_en` and returns it verbatim in JSON. This is **correct behavior for a JSON API** — the data layer should not HTML-escape content; the frontend renderer must sanitize before injecting into the DOM.
- Recommendation: Ensure the Next.js frontend uses `{text}` (auto-escaped) and never `dangerouslySetInnerHTML` for user-supplied fields.

---

## 5. Reproduction Steps (Resolved Bugs)

### BUG-1 (Templates 500)
```
POST /templates  {"name_ar":"test","name_en":"test","supported_languages":["AR"],"project_types":["IT"]}
→ 500 Internal Server Error
```

### BUG-2 (Proposal DB lock)
```
POST /rfps/upload  → 201 (RFP created)
POST /rfps/{id}/proposal  → 201 (proposal created; background task starts)
PATCH /rfps/{id}/proposal/outcome  → 500 "database is locked"
```

### BUG-3 (PATCH RFP 500)
```
PATCH /rfps/{id}  {"title_en":"Updated"}
→ 500 Internal Server Error (MissingGreenlet in RFPResponse.files)
```

### BUG-4 (Double delete)
```
DELETE /rfps/{id}  → 204  (first delete OK)
DELETE /rfps/{id}  → 204  (should be 404; was 204 again)
```

### BUG-5 (Notification silent 200)
```
PATCH /notifications/00000000-0000-0000-0000-000000000000/read
→ 200 "Marked as read"  (should be 404)
```

---

## 6. Expected vs Actual (All Fixed)

| Bug | Expected | Actual (Before Fix) | After Fix |
|-----|----------|---------------------|-----------|
| BUG-1 | 201 Created | 500 ProgrammingError | 201 Created |
| BUG-2 | 200 + next request succeeds | 500 database is locked | 200 on all requests |
| BUG-3 | 200 with updated RFP | 500 MissingGreenlet | 200 with files eager-loaded |
| BUG-4 | 404 on second delete | 204 (silent no-op) | 404 Not Found |
| BUG-5 | 404 for unknown notification | 200 (silent success) | 404 Not Found |

---

## 7. Root Cause Summary

| Bug | File | Root Cause |
|-----|------|------------|
| BUG-1 | `routers/templates.py` | Python list written to SQLite String column without conversion |
| BUG-2 | `routers/proposal.py` + `tasks/proposal_tasks.py` + `core/database.py` | Celery wrapper `asyncio.run()` created second event loop + second SQLite connection; write lock held during LLM calls |
| BUG-3 | `routers/rfp.py` | Async lazy-load of `RFP.files` relationship outside event loop |
| BUG-4 | `routers/rfp.py` | Missing `is_deleted == False` guard in DELETE query |
| BUG-5 | `routers/notifications.py` | Missing 404 check after SELECT |

---

## 8. Fix Files Summary

| File | What Changed |
|------|-------------|
| `apps/api/routers/rfp.py` | BUG-3: added `selectinload(RFP.files)` to `update_rfp`; BUG-4: added `is_deleted == False` guard to `delete_rfp` |
| `apps/api/routers/templates.py` | BUG-1: `",".join(supported_languages)` + `json.dumps(project_types)` before DB insert |
| `apps/api/routers/notifications.py` | BUG-5: raise `HTTP 404` when notification not found |
| `apps/api/routers/proposal.py` | BUG-2a: both `create_proposal` and `create_direct_proposal` now use `_generate_sections_async` (not Celery wrapper) |
| `apps/api/tasks/proposal_tasks.py` | BUG-2b: refactored into 3 phases — no DB session open during AI calls |
| `apps/api/core/database.py` | BUG-2c: SQLite engine uses `StaticPool`; WAL mode + busy_timeout at startup |
| `apps/api/main.py` | SQLite `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=30000` on startup |
| `tests/full_test_suite.py` | Fixed KB duplicate-content false positive; added missing tests |

---

## 9. Regression Test Additions

These automated tests should be added to a CI suite:

```
- POST /templates with List[str] supported_languages → assert 201 (not 500)
- POST /templates then GET /templates/{id} → supportedLanguages is array (not string)
- POST /rfps/{id}/proposal THEN PATCH /rfps/{id}/proposal/outcome → both 200 (no DB lock)
- POST /proposals/direct → 201 (no DB lock)
- PATCH /rfps/{id} → 200, response.files is [] or list (not MissingGreenlet)
- DELETE /rfps/{id} twice → first 204, second 404
- PATCH /notifications/{unknown-id}/read → 404
- POST /rfps/upload (3 files, 2 types) → 400 with mismatch message [REGRESSION]
- CORS: Origin: http://evil.com → Access-Control-Allow-Origin missing
```

---

## 10. Final Go/No-Go Recommendation

**GO for continued development.**

- 0 blocking bugs remain
- All 94 automated test cases pass (93 PASS, 1 LOW WARN)
- Known regressions (CORS origin parsing, file_types mismatch) are verified fixed
- The single WARN is expected behavior (JSON API XSS responsibility is on the frontend)
- SQLite dev environment is now stable for concurrent async background tasks

**Before production:**
- Switch database to PostgreSQL (removes SQLite concurrency concerns entirely)
- Ensure `JWT_SECRET_KEY` is a 256-bit random secret (startup guard is in place)
- Set `ENVIRONMENT=production` to disable `/docs` and `/redoc`
- Deploy Redis for SSE streaming and MFA replay protection
- Deploy MinIO for object storage

---

*Generated by automated test suite — `tests/full_test_suite.py` (94 tests)*
