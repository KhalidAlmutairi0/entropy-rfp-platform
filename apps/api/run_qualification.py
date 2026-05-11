"""
Standalone qualification runner.
Processes any .pdf, .docx, or .md file through the full RFP pipeline
(text extraction → section detection → entity extraction → Claude LLM analysis
→ flag detection → capability matching → scoring → Go/No-Go decision)
WITHOUT needing a database, MinIO, or Celery.

Usage:
    python run_qualification.py <path-to-file>

Example:
    python run_qualification.py C:/Users/Khali/Desktop/pdfs/Entropy_Company_Brief.md
"""

import asyncio
import json
import sys
import time
import io
from pathlib import Path

# Force UTF-8 output on Windows so Arabic text doesn't crash cp1252
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Bootstrap the config so settings (ANTHROPIC_API_KEY etc.) are available ──
import os
sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)


async def run(file_path: str) -> None:
    from tasks.ingestion_tasks import (
        _extract_text,
        _detect_sections,
        _classify_sections,
        _extract_entities,
        _detect_flags,
        _match_capabilities,
        _compute_scores,
        _llm_analyze,
        _merge_llm_results,
        ENTROPY_CAPABILITIES,
    )
    from services.qualification_service import apply_decision_logic

    path = Path(file_path)
    if not path.exists():
        print(f"[ERROR] File not found: {file_path}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  Entropy RFP Qualification Engine")
    print(f"  File: {path.name}")
    print(f"{'='*60}\n")

    start = time.time()

    # ── Step 1: Text extraction ───────────────────────────────────────────────
    _step("1/8", "Text extraction")
    content = path.read_bytes()
    filename = path.name
    mime_type = (
        "application/pdf" if filename.endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if filename.endswith(".docx")
        else "text/markdown"
    )
    all_text = await _extract_text(content, mime_type, filename)
    _done(f"{len(all_text):,} chars extracted")

    # ── Step 2: Section detection ─────────────────────────────────────────────
    _step("2/8", "Section detection")
    sections = _detect_sections(all_text)
    _done(f"{len(sections)} sections found")

    # ── Step 3: Section classification ───────────────────────────────────────
    _step("3/8", "Section classification")
    sections = await _classify_sections(sections)
    types = {}
    for s in sections:
        t = s.get("type", "OTHER")
        types[t] = types.get(t, 0) + 1
    _done("  " + "  ".join(f"{k}:{v}" for k, v in types.items()))

    # ── Step 4: Entity extraction (regex) ────────────────────────────────────
    _step("4/8", "Entity extraction (regex)")

    # Create a minimal RFP stub so _extract_entities doesn't need the DB
    class _RFP:
        deadline = None
        estimated_value_sar = None
        agency = None

    entities = await _extract_entities(sections, _RFP())
    _done(f"agency={entities.get('issuing_agency','?')}  "
          f"value={entities.get('estimated_value_sar','?')}  "
          f"duration={entities.get('duration_months','?')}m  "
          f"certs={entities.get('required_certs', [])}")

    # ── Step 5: Rule-based flag detection ────────────────────────────────────
    _step("5/8", "Rule-based flag detection")
    flags_data = await _detect_flags(sections, entities)
    _done(f"{len(flags_data['red'])} red  {len(flags_data['green'])} green (rule-based)")

    # ── Step 6: Claude LLM deep analysis ─────────────────────────────────────
    _step("6/8", "Claude claude-opus-4-6 deep analysis  ← this takes ~30–60s")
    t0 = time.time()
    llm_result = await _llm_analyze(all_text)
    elapsed = time.time() - t0
    if llm_result:
        entities, flags_data = _merge_llm_results(entities, flags_data, llm_result)
        _done(
            f"{elapsed:.1f}s  confidence={llm_result.get('analyst_confidence','?')}  "
            f"flags after merge: {len(flags_data['red'])} red  {len(flags_data['green'])} green"
        )
    else:
        _done(f"{elapsed:.1f}s  [LLM unavailable — using rule-based only]")

    # ── Step 7: Capability matching ───────────────────────────────────────────
    _step("7/8", "Capability matching")
    capability_result = _match_capabilities(sections, all_text)
    matched = capability_result.get("matched", [])
    _done(f"score={capability_result['score']}/15  matched={len(matched)}: {', '.join(matched) or 'none'}")

    # ── Step 8: Scoring & decision ────────────────────────────────────────────
    _step("8/8", "Scoring & decision")
    scores = _compute_scores(entities, flags_data, capability_result)
    total = max(0.0, min(100.0, scores["technical"] + scores["business"] - scores["risk"]))

    # Build temp flag objects for apply_decision_logic
    temp_flags = [
        type("F", (), {
            "flag_type": "RED",
            "severity": f.get("severity", "MAJOR"),
            "flag_code": f.get("code"),
        })()
        for f in flags_data["red"]
    ]
    decision = apply_decision_logic(total, temp_flags)
    _done(f"Total={total:.1f}/100  →  {decision}")

    # ── Report ────────────────────────────────────────────────────────────────
    wall = time.time() - start
    print(f"\n{'='*60}")
    print(f"  DECISION: {_decision_badge(decision)}")
    print(f"  Score:    {total:.1f} / 100")
    print(f"  Confidence: {scores.get('confidence', 0):.0%}")
    print(f"  Runtime:  {wall:.1f}s")
    print(f"{'='*60}\n")

    print("── Score Breakdown ───────────────────────────────────────")
    print(f"  Technical Fit  : {scores['technical']:5.1f} / 40")
    print(f"  Business Fit   : {scores['business']:5.1f} / 30")
    print(f"  Risk Penalty   : {scores['risk']:5.1f} / 30  (subtracted)")
    print(f"  Total          : {total:5.1f} / 100")

    print("\n── Extracted Entities ────────────────────────────────────")
    for k, v in entities.items():
        if v not in (None, [], {}):
            print(f"  {k:<28} {v}")

    if llm_result.get("summary_en"):
        print("\n── Claude Summary ────────────────────────────────────────")
        print(f"  EN: {llm_result['summary_en']}")
        print(f"  AR: {llm_result.get('summary_ar', '')}")

    print("\n── Red Flags ─────────────────────────────────────────────")
    if flags_data["red"]:
        for f in flags_data["red"]:
            sev = f.get("severity", "?")
            icon = "🔴" if sev == "CRITICAL" else "🟠" if sev == "MAJOR" else "🟡"
            print(f"  {icon} [{sev}] {f.get('title_en', '')}")
            if f.get("quote"):
                print(f"       Quote: \"{f['quote'][:120]}\"")
    else:
        print("  ✅ None")

    print("\n── Green Flags ───────────────────────────────────────────")
    if flags_data["green"]:
        for f in flags_data["green"]:
            print(f"  ✅ {f.get('title_en', '')}")
    else:
        print("  (none detected)")

    if scores.get("low_confidence_sections"):
        print("\n── Low-Confidence Areas ──────────────────────────────────")
        for s in scores["low_confidence_sections"]:
            print(f"  ⚠  {s}")

    print(f"\n{'='*60}\n")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _step(n: str, msg: str) -> None:
    print(f"  [{n}] {msg}…", end=" ", flush=True)

def _done(detail: str = "") -> None:
    print(f"done.  {detail}")

def _decision_badge(d: str) -> str:
    return {"GO": "✅  GO", "REVIEW": "🟡  REVIEW", "NO_GO": "🔴  NO-GO"}.get(d, d)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    asyncio.run(run(sys.argv[1]))
