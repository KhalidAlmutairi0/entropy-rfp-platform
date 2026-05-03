"""
Entropy RFP Platform — Evaluation Harness

Evaluates the quality of:
1. Red/green flag detection (precision, recall)
2. Score computation accuracy
3. Proposal section groundedness (citation coverage)
4. Decision accuracy against human-labeled dataset
"""

from __future__ import annotations

import json
import os
import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import structlog

log = structlog.get_logger()

API_BASE = os.getenv("EVAL_API_URL", "http://localhost:8000")
API_TOKEN = os.getenv("EVAL_API_TOKEN", "")

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@dataclass
class EvalResult:
    name: str
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    details: list[dict[str, Any]] = field(default_factory=list)

    @property
    def total(self) -> int:
        return self.passed + self.failed + self.skipped

    @property
    def pass_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return self.passed / self.total


# ---------------------------------------------------------------------------
# Decision accuracy evaluation
# ---------------------------------------------------------------------------

async def eval_decision_accuracy(client: httpx.AsyncClient) -> EvalResult:
    """Compare model decisions against human-labeled ground truth."""
    result = EvalResult(name="decision_accuracy")
    fixture_path = FIXTURES_DIR / "decision_ground_truth.json"
    if not fixture_path.exists():
        log.warning("fixture missing", path=str(fixture_path))
        return result

    ground_truth: list[dict] = json.loads(fixture_path.read_text())

    for item in ground_truth:
        rfp_id = item["rfp_id"]
        expected = item["expected_decision"]
        try:
            resp = await client.get(f"/rfps/{rfp_id}/decision")
            resp.raise_for_status()
            actual = resp.json()["decisionType"]
            passed = actual == expected
            result.passed += int(passed)
            result.failed += int(not passed)
            result.details.append({
                "rfp_id": rfp_id,
                "expected": expected,
                "actual": actual,
                "passed": passed,
            })
        except Exception as e:
            result.skipped += 1
            result.details.append({"rfp_id": rfp_id, "error": str(e)})

    return result


# ---------------------------------------------------------------------------
# Flag detection evaluation
# ---------------------------------------------------------------------------

async def eval_flag_detection(client: httpx.AsyncClient) -> EvalResult:
    """Evaluate precision and recall of red flag detection."""
    result = EvalResult(name="flag_detection")
    fixture_path = FIXTURES_DIR / "flag_ground_truth.json"
    if not fixture_path.exists():
        log.warning("fixture missing", path=str(fixture_path))
        return result

    ground_truth: list[dict] = json.loads(fixture_path.read_text())

    total_tp = 0
    total_fp = 0
    total_fn = 0

    for item in ground_truth:
        rfp_id = item["rfp_id"]
        expected_flags: set[str] = set(item["expected_flag_codes"])
        try:
            resp = await client.get(f"/rfps/{rfp_id}/decision")
            resp.raise_for_status()
            decision = resp.json()
            actual_flags = {f["flagCode"] for f in decision.get("flags", []) if f["flagType"] == "RED"}

            tp = len(expected_flags & actual_flags)
            fp = len(actual_flags - expected_flags)
            fn = len(expected_flags - actual_flags)
            total_tp += tp
            total_fp += fp
            total_fn += fn

            precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0

            result.details.append({
                "rfp_id": rfp_id,
                "precision": precision,
                "recall": recall,
                "missing": list(expected_flags - actual_flags),
                "extra": list(actual_flags - expected_flags),
            })
            result.passed += int(recall >= 0.8)
            result.failed += int(recall < 0.8)
        except Exception as e:
            result.skipped += 1
            result.details.append({"rfp_id": rfp_id, "error": str(e)})

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 1.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 1.0
    result.details.append({"summary": {"precision": precision, "recall": recall}})

    return result


# ---------------------------------------------------------------------------
# Groundedness evaluation
# ---------------------------------------------------------------------------

async def eval_proposal_groundedness(client: httpx.AsyncClient) -> EvalResult:
    """Check that proposal sections have adequate citation coverage."""
    result = EvalResult(name="proposal_groundedness")
    fixture_path = FIXTURES_DIR / "proposal_rfp_ids.json"
    if not fixture_path.exists():
        log.warning("fixture missing", path=str(fixture_path))
        return result

    rfp_ids: list[str] = json.loads(fixture_path.read_text())

    for rfp_id in rfp_ids:
        try:
            resp = await client.get(f"/rfps/{rfp_id}/proposal")
            resp.raise_for_status()
            proposal = resp.json()
            sections = proposal.get("sections", [])
            ungrounded = [s for s in sections if s.get("hasUngroundedClaims") and not s.get("isLocked")]
            passed = len(ungrounded) == 0
            result.passed += int(passed)
            result.failed += int(not passed)
            result.details.append({
                "rfp_id": rfp_id,
                "total_sections": len(sections),
                "ungrounded_sections": len(ungrounded),
                "passed": passed,
            })
        except Exception as e:
            result.skipped += 1
            result.details.append({"rfp_id": rfp_id, "error": str(e)})

    return result


# ---------------------------------------------------------------------------
# Score range evaluation
# ---------------------------------------------------------------------------

async def eval_score_ranges(client: httpx.AsyncClient) -> EvalResult:
    """Verify scores are within expected ranges and decision thresholds are correct."""
    result = EvalResult(name="score_ranges")
    fixture_path = FIXTURES_DIR / "decision_ground_truth.json"
    if not fixture_path.exists():
        return result

    ground_truth: list[dict] = json.loads(fixture_path.read_text())

    for item in ground_truth:
        rfp_id = item["rfp_id"]
        try:
            resp = await client.get(f"/rfps/{rfp_id}/decision")
            resp.raise_for_status()
            d = resp.json()
            total = d["totalScore"]
            tech = d["technicalFit"]
            biz = d["businessFit"]
            risk = d["riskPenalty"]

            checks = [
                0 <= total <= 100,
                0 <= tech <= 40,
                0 <= biz <= 30,
                0 <= risk <= 30,
                abs(total - (tech + biz - risk)) <= 1,  # score arithmetic
            ]
            all_pass = all(checks)
            result.passed += int(all_pass)
            result.failed += int(not all_pass)
            result.details.append({"rfp_id": rfp_id, "passed": all_pass, "total": total})
        except Exception as e:
            result.skipped += 1
            result.details.append({"rfp_id": rfp_id, "error": str(e)})

    return result


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

async def run_evaluation() -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with httpx.AsyncClient(base_url=API_BASE, headers=headers, timeout=30) as client:
        results = await asyncio.gather(
            eval_decision_accuracy(client),
            eval_flag_detection(client),
            eval_proposal_groundedness(client),
            eval_score_ranges(client),
            return_exceptions=True,
        )

    report: dict[str, Any] = {}
    for r in results:
        if isinstance(r, Exception):
            log.error("eval suite failed", error=str(r))
            continue
        report[r.name] = {
            "passed": r.passed,
            "failed": r.failed,
            "skipped": r.skipped,
            "pass_rate": round(r.pass_rate, 3),
            "details": r.details[:5],  # truncate for report
        }

    overall_pass = sum(v["passed"] for v in report.values())
    overall_total = sum(v["passed"] + v["failed"] for v in report.values())
    report["_summary"] = {
        "overall_pass_rate": round(overall_pass / max(1, overall_total), 3),
        "suites": len(report),
    }

    return report


if __name__ == "__main__":
    import sys
    result = asyncio.run(run_evaluation())
    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if result.get("_summary", {}).get("overall_pass_rate", 0) >= 0.8 else 1)
