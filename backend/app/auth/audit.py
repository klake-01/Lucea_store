from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuditLog


async def record_audit(
    db: AsyncSession,
    staff_id: Optional[str],
    action: str,
    target_table: str,
    record_id: Optional[str] = None,
    before_value: Optional[Any] = None,
    after_value: Optional[Any] = None,
    commit: bool = True,
) -> AuditLog:
    """Appends an entry to the immutable staff action log.

    Called from admin routers after a write succeeds so the journal only ever
    reflects changes that actually landed in the database.
    """
    entry = AuditLog(
        staff_id=staff_id,
        action=action,
        target_table=target_table,
        record_id=record_id,
        before_value=before_value,
        after_value=after_value,
    )
    db.add(entry)
    if commit:
        await db.commit()
    return entry
