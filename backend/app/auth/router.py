from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.redis import get_redis
from app.auth.audit import record_audit
from app.auth.models import StaffUser, AuditLog
from app.auth.schemas import (
    LoginRequest, TokenResponse, RefreshTokenRequest,
    PasswordResetRequest, PasswordResetConfirm, StaffUserResponse, AuditLogResponse
)
from app.auth.service import (
    verify_password, hash_password, create_access_token, create_refresh_token,
    rotate_refresh_token, revoke_refresh_token, revoke_all_refresh_tokens,
    generate_reset_token, verify_reset_token, validate_password_strength
)
from app.auth.dependencies import (
    get_current_user, require_admin, check_login_rate_limit,
    record_failed_login, reset_failed_login, client_ip
)

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    ip = client_ip(request)
    await check_login_rate_limit(payload.username_or_email, ip, redis_client)

    result = await db.execute(
        select(StaffUser).where(
            (StaffUser.username == payload.username_or_email) |
            (StaffUser.email == payload.username_or_email)
        )
    )
    user = result.scalars().first()

    if not user or not verify_password(payload.password, user.password_hash):
        await record_failed_login(payload.username_or_email, ip, redis_client)
        # Failed attempts are journalled so a spraying campaign is visible in
        # the audit trail, without ever storing the attempted password.
        await record_audit(
            db, staff_id=user.id if user else None, action="LOGIN_FAILED",
            target_table="staff_users", record_id=user.id if user else None,
            after_value={"identifier": payload.username_or_email[:64], "ip": ip}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte est desactive"
        )

    await reset_failed_login(payload.username_or_email, ip, redis_client)
    await record_audit(
        db, staff_id=user.id, action="LOGIN_SUCCESS", target_table="staff_users",
        record_id=user.id, after_value={"ip": ip}
    )

    access_token = create_access_token(user_id=user.id, username=user.username, role_name=user.role_name)
    refresh_token = await create_refresh_token(user_id=user.id, redis_client=redis_client)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    redis_key = f"refresh_token:{payload.refresh_token}"
    user_id = await redis_client.get(redis_key)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    result = await db.execute(select(StaffUser).where(StaffUser.id == user_id))
    user = result.scalars().first()

    if not user or not user.is_active:
        await revoke_refresh_token(payload.refresh_token, redis_client)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or not found"
        )

    res = await rotate_refresh_token(
        old_token=payload.refresh_token,
        username=user.username,
        role_name=user.role_name,
        redis_client=redis_client
    )

    if not res:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access_token, new_refresh_token = res
    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)

@router.post("/logout")
async def logout(
    payload: RefreshTokenRequest,
    redis_client = Depends(get_redis)
):
    await revoke_refresh_token(payload.refresh_token, redis_client)
    return {"message": "Successfully logged out"}

@router.post("/password-reset/request")
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    result = await db.execute(select(StaffUser).where(StaffUser.email == payload.email))
    user = result.scalars().first()

    # Prevent username enumeration (per S-A4) - return generic success message
    if user and user.is_active:
        token = await generate_reset_token(user.email, redis_client)
        # In production: send email via Temporal workflow or SMTP adapter
        # print(f"Password reset token for {user.email}: {token}")

    return {"message": "If an account with that email exists, a password reset instructions have been sent."}

@router.post("/password-reset/confirm")
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    email = await verify_reset_token(payload.token, redis_client)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    strength_error = validate_password_strength(payload.new_password)
    if strength_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=strength_error)

    result = await db.execute(select(StaffUser).where(StaffUser.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()

    # Any session opened with the old password is terminated
    revoked = await revoke_all_refresh_tokens(user.id, redis_client)
    await record_audit(
        db, staff_id=user.id, action="PASSWORD_RESET", target_table="staff_users",
        record_id=user.id, after_value={"sessions_revoked": revoked}
    )

    return {"message": "Mot de passe reinitialise. Toutes vos sessions ont ete fermees."}

@router.get("/me", response_model=StaffUserResponse)
async def get_me(current_user: StaffUser = Depends(get_current_user)):
    return current_user

@router.get("/admin/audit-log", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_admin)
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    )
    logs = result.scalars().all()
    return logs

@router.get("/admin/dashboard")
async def get_admin_dashboard(
    days: int = Query(30, ge=7, le=180),
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(get_current_user)
):
    """Everything the dashboard renders, in one round trip.

    Computed in app/analytics.py from the same tables the rest of the admin
    reads, so a headline figure and the list behind it can never disagree.
    """
    from app.analytics import build_dashboard
    return await build_dashboard(db, days=days)
