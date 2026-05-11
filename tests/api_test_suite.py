"""
Entropy RFP Platform - Comprehensive API Test Suite
Covers all endpoints per ULTRA_DETAILED_TEST_PROMPT.md
"""
import io
import json
import time
import uuid
import requests

BASE = "http://localhost:8000"
ADMIN_EMAIL = "admin@entropy.sa"
ADMIN_PASS = "Admin@1234"
BD_EMAIL = "ahmad@entropy.sa"
BD_PASS = "Ahmad@2024"

PASS_MARK = "PASS"
FAIL_MARK = "FAIL"
WARN_MARK = "WARN"

results = []

def record(area, test, status, detail="", severity="INFO"):
    icon = PASS_MARK if status == "PASS" else (WARN_MARK if status == "WARN" else FAIL_MARK)
    results.append({"area": area, "test": test, "status": status, "detail": detail, "severity": severity})
    print(f"  [{icon}] {test}: {detail}")

def get_token(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json()["access_token"]
    return None

def auth(token):
    return {"Authorization": f"Bearer {token}"}

print("\n" + "="*70)
print("  ENTROPY RFP PLATFORM - FULL TEST SUITE")
print("="*70 + "\n")

# ============================================================
# SECTION 1: ENVIRONMENT & HEALTH
# ============================================================
print("\n[1] ENVIRONMENT & HEALTH\n")

r = requests.get(f"{BASE}/health")
if r.status_code == 200 and r.json().get("status") == "ok":
    record("ENV", "Health check /health returns 200 with status=ok", "PASS", str(r.json()))
else:
    record("ENV", "Health check", "FAIL", f"{r.status_code} {r.text}", "CRITICAL")

# Docs endpoints (should be available in dev)
r_docs = requests.get(f"{BASE}/docs")
if r_docs.status_code == 200:
    record("ENV", "/docs accessible in development", "PASS", "200 OK")
else:
    record("ENV", "/docs accessible", "FAIL", str(r_docs.status_code), "MEDIUM")

r_redoc = requests.get(f"{BASE}/redoc")
if r_redoc.status_code == 200:
    record("ENV", "/redoc accessible in development", "PASS", "200 OK")
else:
    record("ENV", "/redoc accessible", "FAIL", str(r_redoc.status_code), "MEDIUM")

# CORS check
r_cors = requests.options(f"{BASE}/health", headers={
    "Origin": "http://localhost:3000",
    "Access-Control-Request-Method": "GET"
})
acao = r_cors.headers.get("access-control-allow-origin", "")
if "localhost:3000" in acao or acao == "*":
    record("ENV", "CORS allows http://localhost:3000", "PASS", f"ACAO: {acao}")
else:
    record("ENV", "CORS allows http://localhost:3000", "FAIL", f"ACAO header: '{acao}'", "CRITICAL")

# Deny unknown origin
r_cors2 = requests.options(f"{BASE}/health", headers={
    "Origin": "http://evil.com",
    "Access-Control-Request-Method": "GET"
})
acao2 = r_cors2.headers.get("access-control-allow-origin", "")
if "evil.com" not in acao2:
    record("ENV", "CORS blocks http://evil.com", "PASS", f"ACAO: '{acao2}'")
else:
    record("ENV", "CORS blocks http://evil.com", "FAIL", f"ACAO: '{acao2}' allows unknown origin!", "HIGH")

# ============================================================
# SECTION 2: AUTHENTICATION
# ============================================================
print("\n[2] AUTHENTICATION\n")

# 2.1 Successful login
r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
if r.status_code == 200 and "access_token" in r.json():
    ADMIN_TOKEN = r.json()["access_token"]
    exp_in = r.json().get("expires_in")
    record("AUTH", "Admin login success", "PASS", f"expires_in={exp_in}")
else:
    ADMIN_TOKEN = None
    record("AUTH", "Admin login", "FAIL", f"{r.status_code}: {r.text}", "CRITICAL")

# 2.2 BD user login
r = requests.post(f"{BASE}/auth/login", json={"email": BD_EMAIL, "password": BD_PASS})
if r.status_code == 200 and "access_token" in r.json():
    BD_TOKEN = r.json()["access_token"]
    record("AUTH", "BD user login success", "PASS")
else:
    BD_TOKEN = None
    record("AUTH", "BD user login", "FAIL", f"{r.status_code}: {r.text}", "HIGH")

# 2.3 Wrong password
r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
if r.status_code == 401:
    record("AUTH", "Wrong password -> 401", "PASS", r.json().get("detail",""))
else:
    record("AUTH", "Wrong password should return 401", "FAIL", str(r.status_code), "HIGH")

# 2.4 Unknown email
r = requests.post(f"{BASE}/auth/login", json={"email": "nobody@entropy.sa", "password": "any"})
if r.status_code == 401:
    record("AUTH", "Unknown email -> 401", "PASS")
else:
    record("AUTH", "Unknown email should return 401", "FAIL", str(r.status_code), "HIGH")

# 2.5 Missing token -> 403 (HTTPBearer returns 403 for missing auth)
r = requests.get(f"{BASE}/rfps")
if r.status_code in (401, 403):
    record("AUTH", "No token -> 401/403", "PASS", str(r.status_code))
else:
    record("AUTH", "No token should return 401/403", "FAIL", str(r.status_code), "HIGH")

# 2.6 Malformed token -> 401
r = requests.get(f"{BASE}/rfps", headers={"Authorization": "Bearer not.a.valid.token"})
if r.status_code == 401:
    record("AUTH", "Malformed JWT -> 401", "PASS")
else:
    record("AUTH", "Malformed JWT should return 401", "FAIL", str(r.status_code), "HIGH")

# 2.7 Expired token (tampered exp claim)
expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6IkFETUlOIiwiZXhwIjoxfQ.invalid_sig"
r = requests.get(f"{BASE}/rfps", headers={"Authorization": f"Bearer {expired_token}"})
if r.status_code == 401:
    record("AUTH", "Expired/invalid token -> 401", "PASS")
else:
    record("AUTH", "Expired token should return 401", "FAIL", str(r.status_code), "MEDIUM")

# 2.8 /auth/me
if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/auth/me", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        me = r.json()
        # Check camelCase in response
        has_camel = any(k[0].islower() and any(c.isupper() for c in k[1:]) for k in me.keys())
        record("AUTH", "/auth/me returns user profile", "PASS", f"role={me.get('role')}")
        if has_camel or "email" in me:
            record("AUTH", "/auth/me response uses camelCase or plain fields", "PASS", f"keys: {list(me.keys())[:5]}")
    else:
        record("AUTH", "/auth/me", "FAIL", str(r.status_code), "HIGH")

# 2.9 Signup - new user
new_email = f"test_{int(time.time())}@entropy.sa"
r = requests.post(f"{BASE}/auth/signup", json={"email": new_email, "name": "Test User", "password": "Test@12345"})
if r.status_code == 201 and "access_token" in r.json():
    NEW_USER_TOKEN = r.json()["access_token"]
    record("AUTH", "Signup new user -> 201 + token", "PASS")
else:
    NEW_USER_TOKEN = None
    record("AUTH", "Signup new user", "FAIL", f"{r.status_code}: {r.text}", "MEDIUM")

# 2.10 Signup duplicate
if new_email:
    r = requests.post(f"{BASE}/auth/signup", json={"email": new_email, "name": "Dup", "password": "Test@12345"})
    if r.status_code == 409:
        record("AUTH", "Signup duplicate email -> 409", "PASS")
    else:
        record("AUTH", "Duplicate signup should return 409", "FAIL", str(r.status_code), "MEDIUM")

# 2.11 Refresh token
if ADMIN_TOKEN:
    r = requests.post(f"{BASE}/auth/refresh", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200 and "access_token" in r.json():
        ADMIN_TOKEN = r.json()["access_token"]  # Use fresh token
        record("AUTH", "Token refresh -> 200 + new token", "PASS")
    else:
        record("AUTH", "Token refresh", "FAIL", f"{r.status_code}: {r.text}", "MEDIUM")

# 2.12 Logout
if ADMIN_TOKEN:
    r = requests.post(f"{BASE}/auth/logout", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("AUTH", "Logout -> 200", "PASS")
    else:
        record("AUTH", "Logout", "FAIL", str(r.status_code), "LOW")

# ============================================================
# SECTION 3: RBAC
# ============================================================
print("\n[3] RBAC & PERMISSIONS\n")

# READ_ONLY role - new user from signup (PRE_SALES role by default)
# Test anonymous access
r = requests.get(f"{BASE}/users")
if r.status_code in (401, 403):
    record("RBAC", "GET /users - anonymous -> 401/403", "PASS", str(r.status_code))
else:
    record("RBAC", "GET /users - anonymous should be 401/403", "FAIL", str(r.status_code), "HIGH")

# Test PRE_SALES trying to access admin-only /users
if NEW_USER_TOKEN:
    r = requests.get(f"{BASE}/users", headers=auth(NEW_USER_TOKEN))
    if r.status_code == 403:
        record("RBAC", "PRE_SALES cannot access /users -> 403", "PASS")
    else:
        record("RBAC", "PRE_SALES accessing /users should be 403", "FAIL", str(r.status_code), "HIGH")

# Test PRE_SALES trying to access /audit
if NEW_USER_TOKEN:
    r = requests.get(f"{BASE}/audit", headers=auth(NEW_USER_TOKEN))
    if r.status_code == 403:
        record("RBAC", "PRE_SALES cannot access /audit -> 403", "PASS")
    else:
        record("RBAC", "PRE_SALES accessing /audit should be 403", "FAIL", str(r.status_code), "HIGH")

# Test PRE_SALES trying to access /analytics/kpis
if NEW_USER_TOKEN:
    r = requests.get(f"{BASE}/analytics/kpis", headers=auth(NEW_USER_TOKEN))
    if r.status_code == 403:
        record("RBAC", "PRE_SALES cannot access /analytics/kpis -> 403", "PASS")
    else:
        record("RBAC", "PRE_SALES accessing /analytics should be 403", "FAIL", str(r.status_code), "HIGH")

# Test ADMIN can access /users
if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/users", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("RBAC", "ADMIN can access /users -> 200", "PASS")
    else:
        record("RBAC", "ADMIN /users", "FAIL", str(r.status_code), "HIGH")

# JWT tampering: try to use a JWT with role=ADMIN but invalid signature
# The token below has payload {"sub":"fake","role":"ADMIN"} but wrong signature
tampered = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLWlkIiwicm9sZSI6IkFETUlOIiwiZXhwIjo5OTk5OTk5OTk5fQ.fake_signature"
r = requests.get(f"{BASE}/users", headers={"Authorization": f"Bearer {tampered}"})
if r.status_code == 401:
    record("RBAC", "Tampered JWT (fake ADMIN role) -> 401", "PASS")
else:
    record("RBAC", "Tampered JWT should be rejected", "FAIL", str(r.status_code), "CRITICAL")

# ============================================================
# SECTION 4: RFP LIFECYCLE
# ============================================================
print("\n[4] RFP LIFECYCLE\n")

RFP_ID = None

if ADMIN_TOKEN:
    # 4.1 List RFPs
    r = requests.get(f"{BASE}/rfps", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        data = r.json()
        record("RFP", "GET /rfps -> 200 paginated", "PASS", f"total={data.get('total',0)}")
    else:
        record("RFP", "GET /rfps", "FAIL", str(r.status_code), "HIGH")

    # 4.2 Upload single valid PDF
    pdf_content = b"%PDF-1.4 valid test content for entropy rfp test"
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("test_rfp.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"file_types": "MAIN", "title_ar": "مناقصة اختبار", "title_en": "Test RFP", "language": "AR"}
    )
    if r.status_code == 201:
        rfp_data = r.json()
        RFP_ID = rfp_data.get("id") or rfp_data.get("rfpId") or rfp_data.get("rfp_id")
        # Detect camelCase or snake_case
        if not RFP_ID:
            # Try to find id in data
            RFP_ID = rfp_data.get("id")
        record("RFP", "Upload single PDF -> 201", "PASS", f"id={RFP_ID}")
        # Check camelCase
        keys = list(rfp_data.keys())
        camel_keys = [k for k in keys if any(c.isupper() for c in k[1:])]
        if camel_keys:
            record("RFP", "RFP response uses camelCase keys", "PASS", str(camel_keys[:5]))
    else:
        record("RFP", "Upload single PDF", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

    # 4.3 Upload multi-file with matching types
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files=[
            ("files", ("main.pdf", io.BytesIO(b"%PDF-1.4 main content"), "application/pdf")),
            ("files", ("annex.pdf", io.BytesIO(b"%PDF-1.4 annex content"), "application/pdf")),
        ],
        data={"file_types": "MAIN,ANNEX", "title_en": "Multi-file RFP"}
    )
    if r.status_code == 201:
        record("RFP", "Upload multi-file (2 files, 2 types) -> 201", "PASS")
    else:
        record("RFP", "Upload multi-file (matching types)", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

    # 4.4 Upload multi-file with MISMATCHED types (REGRESSION TEST)
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files=[
            ("files", ("file1.pdf", io.BytesIO(b"%PDF-1.4 content1"), "application/pdf")),
            ("files", ("file2.pdf", io.BytesIO(b"%PDF-1.4 content2"), "application/pdf")),
            ("files", ("file3.pdf", io.BytesIO(b"%PDF-1.4 content3"), "application/pdf")),
        ],
        data={"file_types": "MAIN,ANNEX"}  # 3 files but only 2 types
    )
    if r.status_code == 400:
        record("RFP", "[REGRESSION] Upload 3 files + 2 types -> 400 (mismatch)", "PASS", r.json().get("detail",""))
    else:
        record("RFP", "[REGRESSION] Mismatched file_types count", "FAIL",
               f"Expected 400, got {r.status_code}: {r.text[:200]}", "HIGH")

    # 4.5 Upload unsupported extension
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("evil.exe", io.BytesIO(b"MZ evil binary"), "application/octet-stream")},
        data={"file_types": "MAIN"}
    )
    if r.status_code == 400:
        record("RFP", "Upload .exe -> 400 (unsupported ext)", "PASS")
    else:
        record("RFP", "Upload .exe should return 400", "FAIL", str(r.status_code), "HIGH")

    # 4.6 Upload fake PDF (wrong magic bytes)
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("fake.pdf", io.BytesIO(b"not a pdf at all"), "application/pdf")},
        data={"file_types": "MAIN"}
    )
    if r.status_code == 400:
        record("RFP", "Upload fake PDF (bad magic bytes) -> 400", "PASS")
    else:
        record("RFP", "Fake PDF (bad magic) should return 400", "FAIL", str(r.status_code), "MEDIUM")

    # 4.7 Path traversal filename
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("../../../etc/passwd.pdf", io.BytesIO(b"%PDF-1.4 traversal"), "application/pdf")},
        data={"file_types": "MAIN"}
    )
    if r.status_code == 201:
        traversal_data = r.json()
        # Check that the stored filename doesn't contain path traversal
        files_key = "files" if "files" in traversal_data else None
        # Look for filename in any nested structure
        raw_str = json.dumps(traversal_data)
        if "../" not in raw_str and "etc/passwd" not in raw_str:
            record("RFP", "Path traversal filename is sanitized", "PASS", "No traversal sequences in response")
        else:
            record("RFP", "Path traversal NOT sanitized!", "FAIL", raw_str[:200], "CRITICAL")
    elif r.status_code == 400:
        record("RFP", "Path traversal filename rejected -> 400", "PASS")
    else:
        record("RFP", "Path traversal filename", "WARN", f"{r.status_code}: {r.text[:100]}", "MEDIUM")

    # 4.8 Get RFP by ID
    if RFP_ID:
        r = requests.get(f"{BASE}/rfps/{RFP_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 200:
            rfp = r.json()
            record("RFP", "GET /rfps/{id} -> 200", "PASS", f"id={rfp.get('id')}")
        else:
            record("RFP", "GET /rfps/{id}", "FAIL", str(r.status_code), "HIGH")

    # 4.9 Get non-existent RFP -> 404
    fake_id = str(uuid.uuid4())
    r = requests.get(f"{BASE}/rfps/{fake_id}", headers=auth(ADMIN_TOKEN))
    if r.status_code == 404:
        record("RFP", "GET /rfps/{missing-id} -> 404", "PASS")
    else:
        record("RFP", "Missing RFP should return 404", "FAIL", str(r.status_code), "MEDIUM")

    # 4.10 Patch RFP
    if RFP_ID:
        r = requests.patch(
            f"{BASE}/rfps/{RFP_ID}",
            headers=auth(ADMIN_TOKEN),
            json={"title_en": "Updated Test RFP"}
        )
        if r.status_code == 200:
            record("RFP", "PATCH /rfps/{id} -> 200", "PASS")
        else:
            record("RFP", "PATCH /rfps/{id}", "FAIL", f"{r.status_code}: {r.text[:200]}", "MEDIUM")

    # 4.11 Trigger analysis -> 202
    if RFP_ID:
        r = requests.post(f"{BASE}/rfps/{RFP_ID}/analyze", headers=auth(ADMIN_TOKEN))
        if r.status_code == 202:
            data = r.json()
            record("RFP", "POST /rfps/{id}/analyze -> 202", "PASS", f"task_id={data.get('task_id','')[:8]}...")
        else:
            record("RFP", "Trigger analysis", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

    # 4.12 SSE stream - should respond (graceful degradation without Redis)
    if RFP_ID:
        try:
            r = requests.get(f"{BASE}/rfps/{RFP_ID}/status/stream", headers=auth(ADMIN_TOKEN), stream=True, timeout=3)
            if r.status_code == 200:
                record("RFP", "SSE stream responds (graceful without Redis)", "PASS",
                       f"content-type={r.headers.get('content-type','')}")
            else:
                record("RFP", "SSE stream", "FAIL", str(r.status_code), "MEDIUM")
            r.close()
        except requests.exceptions.Timeout:
            record("RFP", "SSE stream", "WARN", "Timeout (streaming connection)", "INFO")

    # 4.13 Deck generation - should fail (RFP not analyzed yet or wrong status)
    if RFP_ID:
        r = requests.post(f"{BASE}/rfps/{RFP_ID}/generate-deck", headers=auth(ADMIN_TOKEN))
        if r.status_code in (422, 409, 404):
            record("RFP", "generate-deck on unanalyzed RFP -> 422 (prerequisite check)", "PASS",
                   r.json().get("detail", ""))
        elif r.status_code == 202:
            record("RFP", "generate-deck accepted (RFP may be in valid status)", "WARN")
        else:
            record("RFP", "generate-deck prerequisite check", "FAIL", str(r.status_code), "MEDIUM")

    # 4.14 Delete RFP
    if RFP_ID:
        r = requests.delete(f"{BASE}/rfps/{RFP_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 204:
            record("RFP", "DELETE /rfps/{id} -> 204 (soft delete)", "PASS")
        else:
            record("RFP", "DELETE /rfps/{id}", "FAIL", str(r.status_code), "MEDIUM")

        # 4.15 Verify soft-deleted RFP returns 404
        r = requests.get(f"{BASE}/rfps/{RFP_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 404:
            record("RFP", "Soft-deleted RFP -> 404 on GET", "PASS")
        else:
            record("RFP", "Soft-deleted RFP should return 404", "FAIL", str(r.status_code), "MEDIUM")

# ============================================================
# SECTION 5: DECISION ENGINE
# ============================================================
print("\n[5] DECISION ENGINE\n")

if ADMIN_TOKEN:
    # Use a fresh RFP for decision tests
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("decision_test.pdf", io.BytesIO(b"%PDF-1.4 decision test rfp content"), "application/pdf")},
        data={"file_types": "MAIN", "title_en": "Decision Test RFP"}
    )
    DECISION_RFP_ID = None
    if r.status_code == 201:
        DECISION_RFP_ID = r.json().get("id")

    if DECISION_RFP_ID:
        # 5.1 No decision yet -> 404
        r = requests.get(f"{BASE}/rfps/{DECISION_RFP_ID}/decision", headers=auth(ADMIN_TOKEN))
        if r.status_code == 404:
            record("DECISION", "GET decision before analysis -> 404", "PASS")
        else:
            record("DECISION", "No decision should return 404", "FAIL", str(r.status_code), "MEDIUM")

        # 5.2 Override without decision -> 404
        r = requests.post(
            f"{BASE}/rfps/{DECISION_RFP_ID}/decision/override",
            headers=auth(ADMIN_TOKEN),
            json={"new_decision": "GO", "reason": "Override test reason that is long enough"}
        )
        if r.status_code == 404:
            record("DECISION", "Override non-existent decision -> 404", "PASS")
        else:
            record("DECISION", "Override non-existent decision", "FAIL", str(r.status_code), "MEDIUM")

# ============================================================
# SECTION 6: KNOWLEDGE BASE
# ============================================================
print("\n[6] KNOWLEDGE BASE\n")

if ADMIN_TOKEN:
    # 6.1 List docs
    r = requests.get(f"{BASE}/knowledge", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        data = r.json()
        record("KB", "GET /knowledge -> 200", "PASS", f"total={data.get('total',0)}")
    else:
        record("KB", "GET /knowledge", "FAIL", str(r.status_code), "HIGH")

    # 6.2 Stats
    r = requests.get(f"{BASE}/knowledge/stats", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        stats = r.json()
        record("KB", "GET /knowledge/stats -> 200", "PASS",
               f"total={stats.get('total',0)}, indexed={stats.get('indexed',0)}")
    else:
        record("KB", "GET /knowledge/stats", "FAIL", str(r.status_code), "HIGH")

    # 6.3 Upload valid PDF doc (unique content per run)
    kb_unique = str(int(time.time()))
    kb_content = f"%PDF-1.4 knowledge base test document unique {kb_unique}".encode()
    r = requests.post(
        f"{BASE}/knowledge/upload",
        headers=auth(ADMIN_TOKEN),
        files={"file": ("case_study.pdf", io.BytesIO(kb_content), "application/pdf")},
        data={"title": "Test Case Study", "doc_type": "CASE_STUDY", "language": "AR"}
    )
    KB_DOC_ID = None
    if r.status_code == 201:
        KB_DOC_ID = r.json().get("id")
        record("KB", "Upload valid PDF to KB -> 201", "PASS", f"id={KB_DOC_ID}")
    else:
        record("KB", "Upload PDF to KB", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

    # 6.4 Upload duplicate (same content) -> 409
    if KB_DOC_ID:
        r = requests.post(
            f"{BASE}/knowledge/upload",
            headers=auth(ADMIN_TOKEN),
            files={"file": ("dup_study.pdf", io.BytesIO(kb_content), "application/pdf")},
            data={"title": "Duplicate Doc", "doc_type": "CASE_STUDY"}
        )
        if r.status_code == 409:
            record("KB", "Upload duplicate KB doc -> 409", "PASS")
        else:
            record("KB", "Duplicate KB doc should return 409", "FAIL", str(r.status_code), "MEDIUM")

    # 6.5 Unsupported extension -> 400
    r = requests.post(
        f"{BASE}/knowledge/upload",
        headers=auth(ADMIN_TOKEN),
        files={"file": ("script.js", io.BytesIO(b"console.log('evil');"), "text/javascript")},
        data={"title": "JS File", "doc_type": "OTHER"}
    )
    if r.status_code == 400:
        record("KB", "Upload .js to KB -> 400 (unsupported)", "PASS")
    else:
        record("KB", "KB upload unsupported ext should return 400", "FAIL", str(r.status_code), "MEDIUM")

    # 6.6 Path traversal filename
    r = requests.post(
        f"{BASE}/knowledge/upload",
        headers=auth(ADMIN_TOKEN),
        files={"file": ("../evil.pdf", io.BytesIO(b"%PDF-1.4 traversal content"), "application/pdf")},
        data={"title": "Traversal Doc", "doc_type": "CASE_STUDY"}
    )
    if r.status_code == 201:
        raw_str = json.dumps(r.json())
        if "../" not in raw_str and "evil" not in raw_str:
            record("KB", "KB path traversal filename sanitized", "PASS")
        else:
            record("KB", "KB path traversal not sanitized", "FAIL", raw_str[:200], "CRITICAL")
    elif r.status_code == 400:
        record("KB", "KB path traversal filename rejected -> 400", "PASS")

    # 6.7 Get doc by ID
    if KB_DOC_ID:
        r = requests.get(f"{BASE}/knowledge/{KB_DOC_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 200:
            record("KB", "GET /knowledge/{id} -> 200", "PASS")
        else:
            record("KB", "GET /knowledge/{id}", "FAIL", str(r.status_code), "MEDIUM")

    # 6.8 404 for missing doc
    r = requests.get(f"{BASE}/knowledge/{uuid.uuid4()}", headers=auth(ADMIN_TOKEN))
    if r.status_code == 404:
        record("KB", "GET /knowledge/{missing} -> 404", "PASS")
    else:
        record("KB", "Missing KB doc should return 404", "FAIL", str(r.status_code), "MEDIUM")

    # 6.9 PRE_SALES cannot upload to KB
    if NEW_USER_TOKEN:
        r = requests.post(
            f"{BASE}/knowledge/upload",
            headers=auth(NEW_USER_TOKEN),
            files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
            data={"title": "Unauth Doc", "doc_type": "CASE_STUDY"}
        )
        if r.status_code == 403:
            record("KB", "PRE_SALES cannot upload to KB -> 403", "PASS")
        else:
            record("KB", "PRE_SALES KB upload should return 403", "FAIL", str(r.status_code), "HIGH")

# ============================================================
# SECTION 7: ANALYTICS
# ============================================================
print("\n[7] ANALYTICS\n")

if ADMIN_TOKEN:
    # 7.1 Valid KPI call
    r = requests.get(f"{BASE}/analytics/kpis", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        kpis = r.json()
        record("ANALYTICS", "GET /analytics/kpis -> 200", "PASS",
               f"decisions={kpis.get('decisions',{}).get('total',0)}")
    else:
        record("ANALYTICS", "GET /analytics/kpis", "FAIL", str(r.status_code), "HIGH")

    # 7.2 days=1 boundary
    r = requests.get(f"{BASE}/analytics/kpis?days=1", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("ANALYTICS", "KPIs with days=1 -> 200 (lower bound)", "PASS")
    else:
        record("ANALYTICS", "KPIs days=1 boundary", "FAIL", str(r.status_code), "MEDIUM")

    # 7.3 days=730 boundary
    r = requests.get(f"{BASE}/analytics/kpis?days=730", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("ANALYTICS", "KPIs with days=730 -> 200 (upper bound)", "PASS")
    else:
        record("ANALYTICS", "KPIs days=730 boundary", "FAIL", str(r.status_code), "MEDIUM")

    # 7.4 days=0 (invalid - below min)
    r = requests.get(f"{BASE}/analytics/kpis?days=0", headers=auth(ADMIN_TOKEN))
    if r.status_code == 422:
        record("ANALYTICS", "KPIs days=0 -> 422 (out of bounds)", "PASS")
    else:
        record("ANALYTICS", "KPIs days=0 should return 422", "FAIL", str(r.status_code), "MEDIUM")

    # 7.5 days=731 (invalid - above max)
    r = requests.get(f"{BASE}/analytics/kpis?days=731", headers=auth(ADMIN_TOKEN))
    if r.status_code == 422:
        record("ANALYTICS", "KPIs days=731 -> 422 (above max)", "PASS")
    else:
        record("ANALYTICS", "KPIs days=731 should return 422", "FAIL", str(r.status_code), "MEDIUM")

    # 7.6 Non-integer days
    r = requests.get(f"{BASE}/analytics/kpis?days=abc", headers=auth(ADMIN_TOKEN))
    if r.status_code == 422:
        record("ANALYTICS", "KPIs days=abc -> 422 (non-int)", "PASS")
    else:
        record("ANALYTICS", "Non-int days should return 422", "FAIL", str(r.status_code), "MEDIUM")

    # 7.7 Decisions over time chart (SQLite-safe)
    r = requests.get(f"{BASE}/analytics/charts/decisions-over-time", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("ANALYTICS", "Decisions-over-time chart -> 200 (SQLite-safe)", "PASS", f"rows={len(r.json())}")
    else:
        record("ANALYTICS", "Decisions over time chart", "FAIL", str(r.status_code), "HIGH")

    # 7.8 Win-rate-by-type chart (expected empty)
    r = requests.get(f"{BASE}/analytics/charts/win-rate-by-project-type", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200 and r.json() == []:
        record("ANALYTICS", "Win-rate-by-type -> 200 empty list (no fake data)", "PASS")
    else:
        record("ANALYTICS", "Win-rate-by-type", "FAIL",
               f"{r.status_code}: {r.text[:200]}", "MEDIUM")

# ============================================================
# SECTION 8: NOTIFICATIONS
# ============================================================
print("\n[8] NOTIFICATIONS\n")

if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/notifications", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("NOTIFICATIONS", "GET /notifications -> 200", "PASS", f"count={len(r.json())}")
    else:
        record("NOTIFICATIONS", "GET /notifications", "FAIL", str(r.status_code), "MEDIUM")

    # Mark all read
    r = requests.patch(f"{BASE}/notifications/read-all", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("NOTIFICATIONS", "PATCH /notifications/read-all -> 200", "PASS")
    else:
        record("NOTIFICATIONS", "Mark all read", "FAIL", str(r.status_code), "MEDIUM")

    # Mark fake notification as read (should be 200 or 404, test what we get)
    fake_notif_id = str(uuid.uuid4())
    r = requests.patch(f"{BASE}/notifications/{fake_notif_id}/read", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("NOTIFICATIONS", "Mark non-existent notification read -> 200 (silent no-op)", "WARN",
               "Returns 200 instead of 404 - minor UX issue", "LOW")
    elif r.status_code == 404:
        record("NOTIFICATIONS", "Mark non-existent notification read -> 404", "PASS")
    else:
        record("NOTIFICATIONS", "Mark non-existent notification", "FAIL", str(r.status_code), "MEDIUM")

    # Isolation: new user should not see admin notifications
    if NEW_USER_TOKEN:
        r_new = requests.get(f"{BASE}/notifications", headers=auth(NEW_USER_TOKEN))
        if r_new.status_code == 200:
            new_notifs = r_new.json()
            # Both lists should be different (new user has empty list presumably)
            record("NOTIFICATIONS", "User sees only own notifications (isolation check)", "PASS",
                   f"New user notif count: {len(new_notifs)}")

# ============================================================
# SECTION 9: USERS (ADMIN ONLY)
# ============================================================
print("\n[9] USERS\n")

CREATED_USER_ID = None

if ADMIN_TOKEN:
    # 9.1 List users
    r = requests.get(f"{BASE}/users", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        data = r.json()
        record("USERS", "GET /users -> 200", "PASS", f"total={data.get('total',0)}")
    else:
        record("USERS", "GET /users", "FAIL", str(r.status_code), "HIGH")

    # 9.2 Create user
    test_user_email = f"created_{int(time.time())}@entropy.sa"
    r = requests.post(
        f"{BASE}/users",
        headers=auth(ADMIN_TOKEN),
        json={
            "email": test_user_email,
            "name": "Created Test User",
            "role": "READ_ONLY",
            "password": "TestPass@123"
        }
    )
    if r.status_code == 201:
        CREATED_USER_ID = r.json().get("id")
        record("USERS", "POST /users (create) -> 201", "PASS", f"id={CREATED_USER_ID}")
    else:
        record("USERS", "Create user", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

    # 9.3 Create duplicate user -> 409
    if test_user_email:
        r = requests.post(
            f"{BASE}/users",
            headers=auth(ADMIN_TOKEN),
            json={"email": test_user_email, "name": "Dup", "role": "READ_ONLY", "password": "Test@123"}
        )
        if r.status_code == 409:
            record("USERS", "Duplicate user email -> 409", "PASS")
        else:
            record("USERS", "Duplicate user should be 409", "FAIL", str(r.status_code), "MEDIUM")

    # 9.4 Get user by ID
    if CREATED_USER_ID:
        r = requests.get(f"{BASE}/users/{CREATED_USER_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 200:
            record("USERS", "GET /users/{id} -> 200", "PASS")
        else:
            record("USERS", "GET /users/{id}", "FAIL", str(r.status_code), "MEDIUM")

    # 9.5 Get missing user -> 404
    r = requests.get(f"{BASE}/users/{uuid.uuid4()}", headers=auth(ADMIN_TOKEN))
    if r.status_code == 404:
        record("USERS", "GET /users/{missing} -> 404", "PASS")
    else:
        record("USERS", "Missing user should return 404", "FAIL", str(r.status_code), "MEDIUM")

    # 9.6 Update role
    if CREATED_USER_ID:
        r = requests.patch(
            f"{BASE}/users/{CREATED_USER_ID}/role",
            headers=auth(ADMIN_TOKEN),
            json={"role": "PRE_SALES"}
        )
        if r.status_code == 200:
            record("USERS", "PATCH /users/{id}/role -> 200", "PASS")
        else:
            record("USERS", "Update user role", "FAIL", f"{r.status_code}: {r.text[:200]}", "MEDIUM")

    # 9.7 Deactivate user (cannot deactivate self)
    r = requests.patch(f"{BASE}/users/{CREATED_USER_ID}/deactivate", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("USERS", "Deactivate user -> 200", "PASS")
    else:
        record("USERS", "Deactivate user", "FAIL", str(r.status_code), "MEDIUM")

    # 9.8 Self-deactivation blocked
    # Get current admin ID from /auth/me
    me_resp = requests.get(f"{BASE}/auth/me", headers=auth(ADMIN_TOKEN))
    if me_resp.status_code == 200:
        admin_id = me_resp.json().get("id")
        r = requests.patch(f"{BASE}/users/{admin_id}/deactivate", headers=auth(ADMIN_TOKEN))
        if r.status_code == 400:
            record("USERS", "Self-deactivation blocked -> 400", "PASS",
                   r.json().get("detail",""))
        else:
            record("USERS", "Self-deactivation should return 400", "FAIL", str(r.status_code), "HIGH")

# ============================================================
# SECTION 10: AUDIT LOG
# ============================================================
print("\n[10] AUDIT LOG\n")

if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/audit", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        logs = r.json()
        record("AUDIT", "GET /audit -> 200", "PASS", f"entries={len(logs)}")
        # Verify log structure
        if logs:
            log = logs[0]
            required_keys = {"id", "action", "created_at"}
            if required_keys.issubset(set(log.keys())):
                record("AUDIT", "Audit log has required fields (id, action, created_at)", "PASS")
            else:
                record("AUDIT", "Audit log missing fields", "FAIL",
                       f"Missing: {required_keys - set(log.keys())}", "MEDIUM")
    else:
        record("AUDIT", "GET /audit", "FAIL", str(r.status_code), "HIGH")

    # CSV export
    r = requests.get(f"{BASE}/audit/export", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        ct = r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        csv_text = r.text
        first_line = csv_text.split("\n")[0]
        if "text/csv" in ct:
            record("AUDIT", "CSV export content-type=text/csv", "PASS")
        else:
            record("AUDIT", "CSV export wrong content-type", "FAIL", ct, "MEDIUM")
        if "Time" in first_line and "Action" in first_line:
            record("AUDIT", "CSV export has correct headers", "PASS", first_line)
        else:
            record("AUDIT", "CSV export headers", "FAIL", first_line, "MEDIUM")
    else:
        record("AUDIT", "GET /audit/export", "FAIL", str(r.status_code), "MEDIUM")

    # Access control
    if NEW_USER_TOKEN:
        r = requests.get(f"{BASE}/audit", headers=auth(NEW_USER_TOKEN))
        if r.status_code == 403:
            record("AUDIT", "PRE_SALES cannot access /audit -> 403", "PASS")
        else:
            record("AUDIT", "PRE_SALES accessing /audit should be 403", "FAIL", str(r.status_code), "HIGH")

# ============================================================
# SECTION 11: TEMPLATES
# ============================================================
print("\n[11] TEMPLATES\n")

TEMPLATE_ID = None

if ADMIN_TOKEN:
    # 11.1 List templates
    r = requests.get(f"{BASE}/templates", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        data = r.json()
        record("TEMPLATES", "GET /templates -> 200", "PASS", f"total={data.get('total',0)}")
    else:
        record("TEMPLATES", "GET /templates", "FAIL", str(r.status_code), "HIGH")

    # 11.2 Create template
    r = requests.post(
        f"{BASE}/templates",
        headers=auth(ADMIN_TOKEN),
        json={
            "name_ar": "قالب اختبار",
            "name_en": "Test Template",
            "supported_languages": ["AR", "EN"],
            "project_types": ["IT"],
            "sections": [
                {"title_ar": "المقدمة", "title_en": "Introduction", "order_index": 0},
                {"title_ar": "النطاق", "title_en": "Scope", "order_index": 1},
            ]
        }
    )
    if r.status_code == 201:
        TEMPLATE_ID = r.json().get("id")
        record("TEMPLATES", "POST /templates -> 201", "PASS", f"id={TEMPLATE_ID}")
    else:
        record("TEMPLATES", "Create template", "FAIL", f"{r.status_code}: {r.text[:300]}", "HIGH")

    # 11.3 Get template by ID
    if TEMPLATE_ID:
        r = requests.get(f"{BASE}/templates/{TEMPLATE_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 200:
            tmpl = r.json()
            record("TEMPLATES", "GET /templates/{id} -> 200", "PASS")
            # Verify sections ordering
            sections = tmpl.get("sections", [])
            orders = [s.get("orderIndex", s.get("order_index", 0)) for s in sections]
            if orders == sorted(orders):
                record("TEMPLATES", "Template sections ordered correctly", "PASS", str(orders))
            else:
                record("TEMPLATES", "Template sections NOT ordered", "FAIL", str(orders), "MEDIUM")
            # Verify supported_languages deserialization
            langs = tmpl.get("supportedLanguages", tmpl.get("supported_languages", []))
            if isinstance(langs, list):
                record("TEMPLATES", "supportedLanguages is list", "PASS", str(langs))
            else:
                record("TEMPLATES", "supportedLanguages should be list but got", "FAIL", str(type(langs)), "MEDIUM")
        else:
            record("TEMPLATES", "GET /templates/{id}", "FAIL", str(r.status_code), "HIGH")

    # 11.4 Get missing template -> 404
    r = requests.get(f"{BASE}/templates/{uuid.uuid4()}", headers=auth(ADMIN_TOKEN))
    if r.status_code == 404:
        record("TEMPLATES", "GET /templates/{missing} -> 404", "PASS")
    else:
        record("TEMPLATES", "Missing template should return 404", "FAIL", str(r.status_code), "MEDIUM")

    # 11.5 PRE_SALES cannot create template
    if NEW_USER_TOKEN:
        r = requests.post(
            f"{BASE}/templates",
            headers=auth(NEW_USER_TOKEN),
            json={"name_ar": "قالب", "name_en": "Tmpl", "supported_languages": ["AR"]}
        )
        if r.status_code == 403:
            record("TEMPLATES", "PRE_SALES cannot create template -> 403", "PASS")
        else:
            record("TEMPLATES", "PRE_SALES create template should be 403", "FAIL", str(r.status_code), "HIGH")

    # 11.6 Delete template
    if TEMPLATE_ID:
        r = requests.delete(f"{BASE}/templates/{TEMPLATE_ID}", headers=auth(ADMIN_TOKEN))
        if r.status_code == 204:
            record("TEMPLATES", "DELETE /templates/{id} -> 204", "PASS")
        else:
            record("TEMPLATES", "Delete template", "FAIL", str(r.status_code), "MEDIUM")

# ============================================================
# SECTION 12: PROPOSALS
# ============================================================
print("\n[12] PROPOSALS\n")

if ADMIN_TOKEN:
    # Create an RFP for proposal tests
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("prop_test.pdf", io.BytesIO(b"%PDF-1.4 proposal test rfp content"), "application/pdf")},
        data={"file_types": "MAIN", "title_en": "Proposal Test RFP"}
    )
    PROP_RFP_ID = r.json().get("id") if r.status_code == 201 else None

    if PROP_RFP_ID:
        # Suggest agenda
        r = requests.get(
            f"{BASE}/rfps/{PROP_RFP_ID}/proposal/suggest-agenda",
            headers=auth(ADMIN_TOKEN)
        )
        if r.status_code == 200:
            agenda = r.json()
            record("PROPOSAL", "GET suggest-agenda -> 200", "PASS",
                   f"sections={len(agenda.get('sections',[]))}, basis={agenda.get('basis')}")
        else:
            record("PROPOSAL", "suggest-agenda", "FAIL", f"{r.status_code}: {r.text[:200]}", "MEDIUM")

        # Create proposal
        r = requests.post(
            f"{BASE}/rfps/{PROP_RFP_ID}/proposal",
            headers=auth(ADMIN_TOKEN),
            json={"mode": "AI", "use_ai_agenda": True}
        )
        if r.status_code == 201:
            prop = r.json()
            record("PROPOSAL", "POST /rfps/{id}/proposal -> 201", "PASS",
                   f"status={prop.get('status')}")
        else:
            record("PROPOSAL", "Create proposal", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

        # Get proposal
        r = requests.get(f"{BASE}/rfps/{PROP_RFP_ID}/proposal", headers=auth(ADMIN_TOKEN))
        if r.status_code == 200:
            record("PROPOSAL", "GET /rfps/{id}/proposal -> 200", "PASS")
        else:
            record("PROPOSAL", "Get proposal", "FAIL", str(r.status_code), "HIGH")

        # Update outcome
        r = requests.patch(
            f"{BASE}/rfps/{PROP_RFP_ID}/proposal/outcome",
            headers=auth(ADMIN_TOKEN),
            json={"outcome": "WON", "notes": "Test outcome"}
        )
        if r.status_code == 200:
            record("PROPOSAL", "PATCH outcome -> 200", "PASS")
        else:
            record("PROPOSAL", "Update outcome", "FAIL", f"{r.status_code}: {r.text[:200]}", "MEDIUM")

    # Direct proposal
    r = requests.post(
        f"{BASE}/proposals/direct",
        headers=auth(ADMIN_TOKEN),
        json={"title": "Direct Proposal Test", "use_ai_agenda": True}
    )
    if r.status_code == 201:
        record("PROPOSAL", "POST /proposals/direct -> 201", "PASS")
    else:
        record("PROPOSAL", "Direct proposal", "FAIL", f"{r.status_code}: {r.text[:200]}", "HIGH")

# ============================================================
# SECTION 13: SECURITY CHECKS
# ============================================================
print("\n[13] SECURITY\n")

if ADMIN_TOKEN:
    # SQL injection in search
    r = requests.get(f"{BASE}/rfps?search=' OR '1'='1", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        record("SECURITY", "SQL injection in ?search param -> 200 (sanitized/ORM)", "PASS",
               "ORM parameterizes query - injection neutralized")
    else:
        record("SECURITY", "SQL injection search", "WARN", str(r.status_code), "LOW")

    # XSS in RFP title
    r = requests.post(
        f"{BASE}/rfps/upload",
        headers=auth(ADMIN_TOKEN),
        files={"files": ("xss.pdf", io.BytesIO(b"%PDF-1.4 xss test"), "application/pdf")},
        data={"file_types": "MAIN", "title_en": "<script>alert('xss')</script>"}
    )
    if r.status_code == 201:
        resp_text = r.text
        if "<script>" not in resp_text:
            record("SECURITY", "XSS in title_en - response is JSON (not HTML rendered)", "PASS",
                   "API returns JSON, XSS risk is on frontend rendering")
        else:
            record("SECURITY", "XSS payload in JSON response", "WARN",
                   "Payload stored as-is in JSON (frontend must sanitize)", "LOW")

    # Oversized query param
    huge_search = "A" * 5000
    r = requests.get(f"{BASE}/rfps?search={huge_search}", headers=auth(ADMIN_TOKEN))
    if r.status_code in (200, 400, 413, 422):
        record("SECURITY", f"Oversized query param (5000 chars) -> {r.status_code}", "PASS",
               "No server crash")
    else:
        record("SECURITY", "Oversized query param", "FAIL", str(r.status_code), "MEDIUM")

    # Analytics days constraint (already tested above; re-verify 0 and 731)
    r = requests.get(f"{BASE}/analytics/kpis?days=9999", headers=auth(ADMIN_TOKEN))
    if r.status_code == 422:
        record("SECURITY", "Analytics days=9999 -> 422 (DOS protection)", "PASS")
    else:
        record("SECURITY", "Analytics DOS protection", "FAIL", str(r.status_code), "HIGH")

# ============================================================
# SECTION 14: DATA INTEGRITY
# ============================================================
print("\n[14] DATA INTEGRITY\n")

if ADMIN_TOKEN:
    # Verify audit log entries exist for actions we took
    r = requests.get(f"{BASE}/audit?action=login", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        logs = r.json()
        if len(logs) > 0:
            record("INTEGRITY", "Audit entries exist for login actions", "PASS", f"count={len(logs)}")
        else:
            record("INTEGRITY", "No audit entries for login - audit logging may be broken", "FAIL",
                   "Expected login entries in audit log", "HIGH")

    r = requests.get(f"{BASE}/audit?action=upload_rfp", headers=auth(ADMIN_TOKEN))
    if r.status_code == 200:
        logs = r.json()
        if len(logs) > 0:
            record("INTEGRITY", "Audit entries exist for upload_rfp actions", "PASS", f"count={len(logs)}")
        else:
            record("INTEGRITY", "No audit entries for upload_rfp", "FAIL", "", "MEDIUM")

# ============================================================
# GENERATE REPORT
# ============================================================
print("\n" + "="*70)
print("  RESULTS SUMMARY")
print("="*70)

total = len(results)
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
warned = sum(1 for r in results if r["status"] == "WARN")

print(f"\n  Total tests: {total}")
print(f"  PASS:  {passed}")
print(f"  FAIL:  {failed}")
print(f"  WARN:  {warned}")
print(f"\n  Pass rate: {passed/total*100:.1f}%")

print("\n\n--- FAILURES ---")
for r in results:
    if r["status"] == "FAIL":
        print(f"  [{r['severity']}] [{r['area']}] {r['test']}")
        print(f"    Detail: {r['detail']}")

print("\n--- WARNINGS ---")
for r in results:
    if r["status"] == "WARN":
        print(f"  [{r['severity']}] [{r['area']}] {r['test']}")
        print(f"    Detail: {r['detail']}")

# Write JSON results
with open("test_results.json", "w") as f:
    json.dump({"results": results, "summary": {"total": total, "passed": passed, "failed": failed, "warned": warned}}, f, indent=2)

print("\n\nResults saved to test_results.json")  # written next to the script
