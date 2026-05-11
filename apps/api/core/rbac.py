"""Role-based access control definitions."""

from enum import Enum


class Role(str, Enum):
    ADMIN = "ADMIN"
    BD_MANAGER = "BD_MANAGER"
    BD_PERSON = "BD_PERSON"  # Single actor for Phase 1 MVP — pre-created accounts, sees own RFPs only
    PRE_SALES = "PRE_SALES"
    PROPOSAL_WRITER = "PROPOSAL_WRITER"
    REVIEWER = "REVIEWER"
    READ_ONLY = "READ_ONLY"


class Permission(str, Enum):
    # RFP
    UPLOAD_RFP = "upload_rfp"
    RUN_ANALYSIS = "run_analysis"
    OVERRIDE_DECISION = "override_decision"
    VIEW_RFP = "view_rfp"

    # Proposal
    GENERATE_PROPOSAL = "generate_proposal"
    EDIT_PROPOSAL = "edit_proposal"
    APPROVE_PROPOSAL = "approve_proposal"
    EXPORT_PROPOSAL = "export_proposal"

    # Admin
    MANAGE_KB = "manage_kb"
    MANAGE_USERS = "manage_users"
    VIEW_AUDIT_LOG = "view_audit_log"
    MANAGE_TEMPLATES = "manage_templates"
    VIEW_ANALYTICS = "view_analytics"
    MANAGE_SETTINGS = "manage_settings"


role_permissions: dict[Role, set[Permission]] = {
    Role.ADMIN: set(Permission),  # All permissions

    Role.BD_MANAGER: {
        Permission.UPLOAD_RFP,
        Permission.RUN_ANALYSIS,
        Permission.OVERRIDE_DECISION,
        Permission.VIEW_RFP,
        Permission.GENERATE_PROPOSAL,
        Permission.EDIT_PROPOSAL,
        Permission.APPROVE_PROPOSAL,
        Permission.EXPORT_PROPOSAL,
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_TEMPLATES,
    },

    Role.BD_PERSON: {
        Permission.UPLOAD_RFP,
        Permission.RUN_ANALYSIS,
        Permission.VIEW_RFP,
        Permission.GENERATE_PROPOSAL,
        Permission.EDIT_PROPOSAL,
        Permission.EXPORT_PROPOSAL,
    },

    Role.PRE_SALES: {
        Permission.UPLOAD_RFP,
        Permission.RUN_ANALYSIS,
        Permission.OVERRIDE_DECISION,
        Permission.VIEW_RFP,
        Permission.GENERATE_PROPOSAL,
        Permission.EDIT_PROPOSAL,
        Permission.EXPORT_PROPOSAL,
    },

    Role.PROPOSAL_WRITER: {
        Permission.VIEW_RFP,
        Permission.GENERATE_PROPOSAL,
        Permission.EDIT_PROPOSAL,
        Permission.EXPORT_PROPOSAL,
    },

    Role.REVIEWER: {
        Permission.VIEW_RFP,
        Permission.APPROVE_PROPOSAL,
    },

    Role.READ_ONLY: {
        Permission.VIEW_RFP,
    },
}
