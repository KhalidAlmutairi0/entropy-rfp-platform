"""Qualification service — wraps the scoring logic for use by the API."""

from models.flag import Flag


def apply_decision_logic(total_score: float, flags: list[Flag]) -> str:
    """
    Apply the canonical 8-dimension decision logic.

    Thresholds (per Entropy RFP Intelligence System Prompt v1.0):
      GO          : total ≥ 80 AND no critical/major red flag
      REVIEW      : 45 ≤ total < 80  OR  has major flags (but no critical)
      NO_GO       : total < 45  OR  any critical red flag

    Override rules — any one triggers immediate NO_GO regardless of score:
      - SCOPE_MISMATCH (pure cybersecurity, clinical healthcare, physical infrastructure)
      - DATA_RESIDENCY_OUTSIDE_KSA
      - PDPL_CONFLICT
      - CONFLICT_OF_INTEREST
      - Any flag with severity == CRITICAL
    """
    # MANDATORY_CERT_NOT_HELD is NOT auto-critical — severity on the flag itself
    # determines impact (CRITICAL for SAMA CSF / NCA ECC, MAJOR for ISO 27001 etc.)
    CRITICAL_FLAG_CODES = {
        "PDPL_CONFLICT",
        "DATA_RESIDENCY_OUTSIDE_KSA",
        "CONFLICT_OF_INTEREST",
        "SCOPE_MISMATCH",   # Instant NO-GO: cybersecurity, clinical, hardware
    }

    red_flags = [f for f in flags if f.flag_type == "RED"]
    has_critical = any(
        f.flag_code in CRITICAL_FLAG_CODES or f.severity == "CRITICAL"
        for f in red_flags
    )
    has_major = any(f.severity == "MAJOR" for f in red_flags)

    if has_critical:
        return "NO_GO"
    if total_score >= 80 and not has_major:
        return "GO"
    if total_score >= 45:
        return "REVIEW"   # Covers both CONDITIONAL GO (65-79) and WATCH (45-64) bands
    return "NO_GO"
