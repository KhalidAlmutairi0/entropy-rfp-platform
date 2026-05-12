"""Create all tables on a fresh database, then stamp Alembic as up-to-date."""
import asyncio
import subprocess
import sys

async def main():
    # Import all models so Base.metadata knows about them
    from core.database import engine, Base
    import models.user
    import models.rfp
    import models.rfp_file
    import models.decision
    import models.flag
    import models.proposal
    import models.proposal_section
    import models.knowledge_doc
    import models.template
    import models.notification
    import models.audit_log

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created.")

    # Stamp alembic so it knows migrations are applied
    result = subprocess.run(["alembic", "stamp", "head"], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)

asyncio.run(main())
