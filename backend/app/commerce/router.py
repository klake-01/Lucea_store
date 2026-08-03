from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.audit import record_audit
from app.auth.dependencies import require_role, require_admin
from app.auth.models import StaffUser
from app.commerce.schemas import (
    VoucherCreate, VoucherUpdate, VoucherResponse, VoucherListResponse
)
from app.commerce.service import (
    list_vouchers, create_voucher, update_voucher, delete_voucher,
    get_voucher_by_id, generate_code
)

router = APIRouter()


def _serialise(voucher) -> VoucherResponse:
    """Attaches the computed status so the admin never recomputes it."""
    payload = VoucherResponse.model_validate(voucher)
    payload.status = voucher.status_label()
    return payload


@router.get("/admin/vouchers", response_model=VoucherListResponse)
async def admin_list_vouchers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    items, total = await list_vouchers(db, page=page, limit=limit, search=search)
    return VoucherListResponse(
        items=[_serialise(v) for v in items], total=total, page=page, limit=limit
    )


@router.get("/admin/vouchers/suggest-code")
async def admin_suggest_code(
    prefix: str = "",
    _: StaffUser = Depends(require_role("editor")),
):
    """Preview a code in the create form without persisting anything."""
    return {"code": generate_code(prefix)}


@router.post("/admin/vouchers", response_model=VoucherResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_voucher(
    payload: VoucherCreate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    voucher = await create_voucher(db, payload, staff_id=staff.id)
    await record_audit(
        db, staff_id=staff.id, action="CREATE_VOUCHER", target_table="vouchers",
        record_id=voucher.id,
        after_value={"code": voucher.code, "type": voucher.discount_type, "value": voucher.value},
    )
    return _serialise(voucher)


@router.put("/admin/vouchers/{voucher_id}", response_model=VoucherResponse)
async def admin_update_voucher(
    voucher_id: str,
    payload: VoucherUpdate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    existing = await get_voucher_by_id(db, voucher_id)
    before = {"value": existing.value, "active": existing.active_status} if existing else None
    voucher = await update_voucher(db, voucher_id, payload)
    await record_audit(
        db, staff_id=staff.id, action="UPDATE_VOUCHER", target_table="vouchers",
        record_id=voucher_id, before_value=before,
        after_value={"value": voucher.value, "active": voucher.active_status},
    )
    return _serialise(voucher)


@router.delete("/admin/vouchers/{voucher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin),
):
    existing = await get_voucher_by_id(db, voucher_id)
    before = {"code": existing.code} if existing else None
    await delete_voucher(db, voucher_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_VOUCHER", target_table="vouchers",
        record_id=voucher_id, before_value=before,
    )
    return None
