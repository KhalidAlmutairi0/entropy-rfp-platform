"""Qualification service — wraps the scoring logic for use by the API."""

from models.flag import Flag


def apply_decision_logic(total_score: float, flags: list[Flag]) -> str:
    """
    Apply the canonical decision logic.

    GO  : total ≥ 75 AND no critical red flag
    REVIEW : 50 ≤ total < 75 OR has major red flag (but no critical)
    NO_GO : otherwise OR any critical red flag
    """
    # MANDATORY_CERT_NOT_HELD is NOT auto-critical — severity on the flag itself
    # determines impact (CRITICAL for SAMA CSF / NCA ECC, MAJOR for ISO 27001 etc.)
    CRITICAL_FLAG_CODES = {
        "PDPL_CONFLICT",
        "DATA_RESIDENCY_OUTSIDE_KSA",
        "CONFLICT_OF_INTEREST",
    }

    red_flags = [f for f in flags if f.flag_type == "RED"]
    has_critical = any(f.flag_code in CRITICAL_FLAG_CODES or f.severity == "CRITICAL" for f in red_flags)
    has_major = any(f.severity == "MAJOR" for f in red_flags)

    if has_critical:
        return "NO_GO"
    if total_score >= 60 and not has_major:
        return "GO"
    if total_score >= 40:
        return "REVIEW"   # MAJOR flags here drop GO→REVIEW, but score must still be ≥40
    return "NO_GO"
