"""
Entropy RFP Qualification Engine — Deep Forensic Analysis
=========================================================
Exhaustive Go/No-Go analysis of any RFP document.
Analysis takes 3–8 minutes. Output: detailed terminal report.

Usage:
    python run_qualification.py <path-to-rfp>

Supported: .pdf  .docx  .md  .txt
"""

import asyncio
import io
import json
import os
import sys
import textwrap
import time
from pathlib import Path

# UTF-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)

W = 72

def _hr(char="─"): print(char * W)
def _hr2(char="━"): print(char * W)
def _header(title):
    _hr2(); print(f"  {title}"); _hr2()
def _section(title):
    print(); _hr(); print(f"  {title}"); _hr()
def _step(n, msg):
    print(f"  [{n}] {msg}…", end=" ", flush=True)
def _done(detail=""):
    print(f"✓  {detail}")
def _wrap(text, indent=4):
    return textwrap.fill(str(text), width=W, initial_indent=" "*indent, subsequent_indent=" "*indent)
def _page_ref(page):
    return f"  [p.{page}]" if page else ""
def _sev_icon(s):
    return {"CRITICAL":"🔴","MAJOR":"🟠","MINOR":"🟡"}.get(s,"⚪")
def _imp_icon(i):
    return {"HIGH":"🟢","MEDIUM":"🔵","LOW":"⚪"}.get(i,"⚪")

def _decision_banner(decision, score):
    print(); _hr2("═")
    icons = {"GO":"✅","REVIEW":"🟡","NO_GO":"🔴"}
    labels = {"GO":"GO — Proceed with proposal","REVIEW":"REVIEW — Manual evaluation required","NO_GO":"NO-GO — Do not bid"}
    print(f"  {icons.get(decision,'?')}  DECISION : {labels.get(decision, decision)}")
    print(f"  📊  Score    : {score:.1f} / 100")
    _hr2("═"); print()


async def run(file_path: str) -> None:
    from tasks.ingestion_tasks import (
        _extract_text, _detect_sections, _classify_sections,
        _extract_entities, _detect_flags, _match_capabilities,
        _compute_scores, _llm_analyze, _merge_llm_results,
        ENTROPY_CAPABILITIES,
    )
    from services.qualification_service import apply_decision_logic

    path = Path(file_path)
    if not path.exists():
        print(f"\n[ERROR] File not found: {file_path}"); sys.exit(1)

    _header("Entropy RFP Qualification Engine — Forensic Analysis")
    print(f"  File    : {path.name}")
    print(f"  Started : {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Mode    : DEEP FORENSIC  (≤8 min)")
    _hr2(); print()

    wall_start = time.time()

    # 1. Extract
    _step("1/8", "Extracting text (page-aware)")
    content = path.read_bytes()
    filename = path.name
    mime_type = (
        "application/pdf" if filename.endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if filename.endswith(".docx") else "text/markdown"
    )
    all_text = await _extract_text(content, mime_type, filename)
    _done(f"{len(all_text):,} chars  |  {all_text.count('[PAGE ')} pages")

    # 2. Sections
    _step("2/8", "Detecting sections")
    sections = _detect_sections(all_text)
    _done(f"{len(sections)} sections")

    # 3. Classify
    _step("3/8", "Classifying sections")
    sections = await _classify_sections(sections)
    types: dict = {}
    for s in sections:
        t = s.get("type","OTHER"); types[t] = types.get(t,0)+1
    _done("  ".join(f"{k}:{v}" for k,v in types.items()))

    # 4. Entities
    _step("4/8", "Extracting entities")
    class _RFP:
        deadline = None; estimated_value_sar = None; agency = None
    entities = await _extract_entities(sections, _RFP())
    _done(f"agency={entities.get('issuing_agency','?')}  certs={entities.get('required_certs',[])}")

    # 5. Rule flags
    _step("5/8", "Rule-based flag detection")
    flags_data = await _detect_flags(sections, entities)
    _done(f"{len(flags_data['red'])} red  |  {len(flags_data['green'])} green")

    # 6. Claude deep analysis
    print()
    print("  [6/8] 🤖 Claude Opus — Forensic deep analysis")
    print("        Analyzing ALL requirements, advantages, gaps, rejection risks…")
    print("        Estimated time: 2–5 minutes. Please wait.")
    t0 = time.time()
    llm_result = await _llm_analyze(all_text)
    elapsed = time.time() - t0
    if llm_result:
        entities, flags_data = _merge_llm_results(entities, flags_data, llm_result)
        adv = len(llm_result.get("advantages",[]))
        dis = len(llm_result.get("disadvantages",[]))
        rej = len(llm_result.get("rejection_reasons",[]))
        bst = len(llm_result.get("acceptance_boosters",[]))
        print(f"        ✓ Done in {elapsed:.0f}s  |  confidence={llm_result.get('analyst_confidence','?')}")
        print(f"          advantages={adv}  disadvantages={dis}  rejection_reasons={rej}  boosters={bst}")
        print(f"          red_flags={len(flags_data['red'])}  green_flags={len(flags_data['green'])}")
    else:
        print(f"        ⚠  LLM unavailable ({elapsed:.0f}s) — rule-based only")
    print()

    # 7. Capabilities
    _step("7/8", "Capability matching")
    capability_result = _match_capabilities(sections, all_text)
    matched = capability_result.get("matched",[])
    _done(f"score={capability_result['score']}/15  matched: {', '.join(matched) or 'none'}")

    # 8. Score
    _step("8/8", "Scoring & decision")
    scores = _compute_scores(entities, flags_data, capability_result)
    total = max(0.0, min(100.0, scores["technical"] + scores["business"] - scores["risk"]))
    temp_flags = [
        type("F",(),{"flag_type":"RED","severity":f.get("severity","MAJOR"),"flag_code":f.get("code")})()
        for f in flags_data["red"]
    ]
    decision = apply_decision_logic(total, temp_flags)
    _done(f"Total={total:.1f}/100  →  {decision}  ({time.time()-wall_start:.0f}s total)")

    # ══════════════════════════════════════════════════════════════
    # REPORT
    # ══════════════════════════════════════════════════════════════

    wall_total = time.time() - wall_start
    _decision_banner(decision, total)

    # Score breakdown
    _section("SCORE BREAKDOWN")
    print(f"  Technical Fit   : {scores['technical']:5.1f} / 40")
    print(f"  Business Fit    : {scores['business']:5.1f} / 30")
    print(f"  Risk Penalty    : {scores['risk']:5.1f} / 30  (subtracted)")
    print(f"  {'─'*35}")
    print(f"  TOTAL           : {total:5.1f} / 100")
    print(f"  Confidence      : {scores.get('confidence',0):.0%}")
    print(f"  Analysis Time   : {wall_total:.0f}s")

    # Summary
    if llm_result and llm_result.get("summary_en"):
        _section("EXECUTIVE SUMMARY")
        print(_wrap(llm_result["summary_en"], indent=2))
        if llm_result.get("summary_ar"):
            print(); print(_wrap(llm_result["summary_ar"], indent=2))

    # Entities
    _section("EXTRACTED ENTITIES")
    for k in ["issuing_agency","estimated_value_sar","deadline","duration_months",
              "deployment_model","required_certs","local_content_pct",
              "data_outside_ksa","requires_security_clearance","primary_language"]:
        v = entities.get(k)
        if v not in (None,[],{}): print(f"  {k:<32} {v}")
    if entities.get("project_objectives"):
        print(f"\n  Project Objectives:")
        for o in entities["project_objectives"]: print(f"    • {o}")
    if entities.get("key_deliverables"):
        print(f"\n  Key Deliverables:")
        for d in entities["key_deliverables"]: print(f"    • {d}")

    # Advantages
    advantages = (llm_result or {}).get("advantages",[])
    if advantages:
        _section(f"ADVANTAGES  ({len(advantages)})")
        for i,a in enumerate(advantages,1):
            pr = _page_ref(a.get("page"))
            print(f"\n  {i}. {_imp_icon(a.get('impact','MEDIUM'))} [{a.get('impact','MEDIUM')}]  {a.get('title_en','')}{pr}")
            print(_wrap(a.get("description_en",""), indent=5))
            if a.get("title_ar"): print(_wrap(a.get("title_ar",""), indent=5))
            if a.get("evidence"): print(_wrap(f'» "{a["evidence"][:200]}"', indent=6))

    # Disadvantages
    disadvantages = (llm_result or {}).get("disadvantages",[])
    if disadvantages:
        _section(f"DISADVANTAGES  ({len(disadvantages)})")
        for i,d in enumerate(disadvantages,1):
            sev = d.get("severity","MINOR")
            pr = _page_ref(d.get("page"))
            blocker = "  ⛔ DEAL-BREAKER" if d.get("is_deal_breaker") else ""
            print(f"\n  {i}. {_sev_icon(sev)} [{sev}]{blocker}  {d.get('title_en','')}{pr}")
            print(_wrap(d.get("description_en",""), indent=5))
            if d.get("title_ar"): print(_wrap(d.get("title_ar",""), indent=5))
            if d.get("evidence"): print(_wrap(f'» "{d["evidence"][:200]}"', indent=6))

    # Rejection reasons
    rejection_reasons = (llm_result or {}).get("rejection_reasons",[])
    if rejection_reasons:
        _section(f"REJECTION REASONS  ({len(rejection_reasons)})")
        blockers = [r for r in rejection_reasons if not r.get("can_mitigate")]
        mitigable = [r for r in rejection_reasons if r.get("can_mitigate")]
        if blockers:
            print(f"\n  ⛔ HARD BLOCKERS — cannot be mitigated:")
            for i,r in enumerate(blockers,1):
                pr = _page_ref(r.get("page"))
                print(f"\n  {i}. 🔴 {r.get('reason_en','')}{pr}")
                if r.get("reason_ar"): print(f"      {r.get('reason_ar','')}")
                if r.get("evidence"): print(_wrap(f'» "{r["evidence"][:250]}"', indent=6))
        if mitigable:
            print(f"\n  ⚠️  MITIGABLE RISKS — can be addressed:")
            for i,r in enumerate(mitigable,1):
                pr = _page_ref(r.get("page"))
                print(f"\n  {i}. 🟠 {r.get('reason_en','')}{pr}")
                if r.get("reason_ar"): print(f"      {r.get('reason_ar','')}")
                if r.get("evidence"): print(_wrap(f'» "{r["evidence"][:200]}"', indent=6))
                if r.get("mitigation_strategy"):
                    print(_wrap(f"✏  Mitigation: {r['mitigation_strategy']}", indent=6))

    # Acceptance boosters
    boosters = (llm_result or {}).get("acceptance_boosters",[])
    if boosters:
        _section(f"WHAT COULD HELP WIN THIS  ({len(boosters)})")
        for i,b in enumerate(boosters,1):
            pr = _page_ref(b.get("page"))
            print(f"\n  {i}. 💡 {b.get('booster_en','')}{pr}")
            if b.get("booster_ar"): print(f"      {b.get('booster_ar','')}")
            if b.get("action_required"):
                print(_wrap(f"→ Action: {b['action_required']}", indent=6))
            if b.get("evidence"):
                print(_wrap(f'» "{b["evidence"][:150]}"', indent=6))

    # All technical requirements
    tech_reqs = entities.get("technical_requirements",[])
    if tech_reqs:
        can    = [r for r in tech_reqs if r.get("entropy_can_fulfill") is True]
        partial= [r for r in tech_reqs if r.get("entropy_can_fulfill") == "partial"]
        cannot = [r for r in tech_reqs if r.get("entropy_can_fulfill") is False]
        _section(f"ALL TECHNICAL REQUIREMENTS  ({len(tech_reqs)} total)")
        if can:
            print(f"\n  ✅ CAN FULFILL ({len(can)}):")
            for r in can:
                pr = _page_ref(r.get("page"))
                print(f"    ✅ {r.get('requirement','')[:100]}{pr}")
                if r.get("fulfillment_notes"): print(f"       → {r['fulfillment_notes'][:100]}")
        if partial:
            print(f"\n  ⚡ PARTIAL ({len(partial)}):")
            for r in partial:
                pr = _page_ref(r.get("page"))
                print(f"    ⚡ {r.get('requirement','')[:100]}{pr}")
                if r.get("fulfillment_notes"): print(f"       → {r['fulfillment_notes'][:100]}")
        if cannot:
            print(f"\n  ❌ CANNOT FULFILL ({len(cannot)}):")
            for r in cannot:
                pr = _page_ref(r.get("page"))
                print(f"    ❌ {r.get('requirement','')[:100]}{pr}")
                if r.get("fulfillment_notes"): print(f"       → {r['fulfillment_notes'][:100]}")

    # Mandatory blockers
    mandatory = entities.get("mandatory_requirements",[])
    blockers_m = [r for r in mandatory if r.get("is_blocker")]
    if blockers_m:
        _section(f"MANDATORY BLOCKERS  ({len(blockers_m)})")
        for r in blockers_m:
            pr = _page_ref(r.get("page"))
            print(f"\n  ⛔ {r.get('requirement','')[:120]}{pr}")
            if r.get("blocker_reason"):
                print(_wrap(f"Reason: {r['blocker_reason']}", indent=5))
            if r.get("quote"):
                print(_wrap(f'» "{r["quote"][:200]}"', indent=5))

    # Red flags
    _section(f"RED FLAGS  ({len(flags_data['red'])})")
    if flags_data["red"]:
        for f in sorted(flags_data["red"], key=lambda x: {"CRITICAL":0,"MAJOR":1,"MINOR":2}.get(x.get("severity","MINOR"),2)):
            sev = f.get("severity","?")
            pr = _page_ref(f.get("page"))
            print(f"\n  {_sev_icon(sev)} [{sev}]  {f.get('title_en','')}{pr}")
            if f.get("title_ar"): print(f"           {f.get('title_ar','')}")
            desc = f.get("description_en") or f.get("description","")
            if desc: print(_wrap(desc, indent=5))
            q = f.get("quote") or f.get("evidence","")
            if q: print(_wrap(f'» "{q[:250]}"', indent=5))
    else:
        print("  ✅ No red flags detected")

    # Green flags
    _section(f"GREEN FLAGS  ({len(flags_data['green'])})")
    if flags_data["green"]:
        for f in flags_data["green"]:
            pr = _page_ref(f.get("page"))
            print(f"  ✅ {f.get('title_en','')}{pr}")
            if f.get("title_ar"): print(f"      {f.get('title_ar','')}")
            desc = f.get("description_en","")
            if desc: print(_wrap(desc, indent=5))
    else:
        print("  (none detected)")

    # Missing capabilities
    missing = (llm_result or {}).get("missing_capabilities",[])
    if missing:
        _section(f"CAPABILITIES WE LACK  ({len(missing)})")
        for m in missing: print(f"  ❌ {m}")

    # Analyst notes
    if llm_result and llm_result.get("analyst_notes"):
        _section("ANALYST NOTES")
        print(_wrap(llm_result["analyst_notes"], indent=2))

    # Final decision repeated
    _decision_banner(decision, total)
    print(f"  Total analysis time: {wall_total:.0f}s")
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    asyncio.run(run(sys.argv[1]))
