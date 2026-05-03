# Compliance & Data Governance

## Regulatory Framework

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| NDMO       | Data classification + governance | All data classified at creation |
| PDPL       | Personal data protection          | Minimal PII collection, purpose limitation |
| SDAIA      | AI system transparency            | Decision explanations in Arabic |
| CCC        | Cloud computing controls          | KSA-region deployments only |

## Data Residency

**All data must remain within KSA boundaries.**

- PostgreSQL, Redis, Qdrant, MinIO: deployed in KSA region
- AI API calls: only to providers with KSA data processing agreements
- No data exfiltration to external systems
- Audit trail for all data access

## Data Classification

| Level       | Description                   | Examples                           |
|-------------|-------------------------------|------------------------------------|
| PUBLIC      | Available externally          | Company website content            |
| INTERNAL    | Internal use only             | RFP summaries, decisions           |
| CONFIDENTIAL| Sensitive business data       | Pricing, strategies, proposals     |
| RESTRICTED  | Highest sensitivity           | Personal data, credentials         |

RFP documents and proposals are classified **CONFIDENTIAL** by default.

## Access Control

- Authentication: Keycloak SSO + MFA (mandatory for ADMIN/BD_MANAGER)
- Authorization: Role-Based Access Control (RBAC)
- Session timeout: 8 hours inactivity
- Failed login lockout: 5 attempts → 30-minute lockout

## Audit Requirements

All of the following are logged with timestamp, user, IP, and before/after values:
- User login/logout
- RFP upload and deletion
- Decision override
- Proposal export
- User role changes
- Knowledge base modifications
- Weight adjustments

Audit logs are:
- Immutable (no update/delete operations)
- Retained for minimum 5 years
- Exportable as CSV for compliance reviews
- Accessible only to ADMIN role

## Personal Data

Personal data collected:
- User name and email (required for authentication)
- User preferences (language, timezone)
- IP addresses in audit logs

Personal data is:
- Collected only for specified purposes
- Not shared with third parties
- Retained per PDPL requirements
- Deletable upon request (ADMIN function)

## AI Transparency

Per SDAIA requirements:
- Every AI-generated decision includes a human-readable explanation in Arabic
- Users can override AI decisions with mandatory justification
- All AI outputs are labeled as AI-generated
- Confidence scores are displayed to users
- Hallucination prevention: citation requirements for all claims

## Security Controls

- Passwords: bcrypt with cost factor ≥ 12
- JWT: RS256, 24-hour expiry
- HTTPS: TLS 1.3 minimum
- Database: encrypted at rest
- Backups: encrypted, tested quarterly
- Secrets: managed via environment variables, never in code
- Dependencies: scanned weekly for CVEs

## Incident Response

1. Detection: automated monitoring + manual reports
2. Containment: revoke affected credentials immediately
3. Assessment: determine scope within 2 hours
4. Notification: SDAIA within 72 hours if personal data affected
5. Recovery: restore from last clean backup
6. Post-incident: root cause analysis within 5 days
