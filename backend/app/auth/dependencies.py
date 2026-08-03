from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.redis import get_redis
from app.auth.models import StaffUser
from app.auth.service import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 900 # 15 minutes
# Per source address, so credential spraying across many usernames from one
# host is throttled even though no single account ever locks out.
MAX_FAILED_ATTEMPTS_PER_IP = 20


def client_ip(request: Request) -> str:
    """Real client address behind the nginx proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_login_rate_limit(username: str, ip: str, redis_client=Depends(get_redis)):
    attempts = await redis_client.get(f"failed_login:{username}")
    if attempts and int(attempts) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Compte temporairement verrouille apres plusieurs tentatives. Reessayez dans 15 minutes."
        )

    ip_attempts = await redis_client.get(f"failed_login_ip:{ip}")
    if ip_attempts and int(ip_attempts) >= MAX_FAILED_ATTEMPTS_PER_IP:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives depuis cette adresse. Reessayez dans 15 minutes."
        )

async def record_failed_login(username: str, ip: str, redis_client):
    for key in (f"failed_login:{username}", f"failed_login_ip:{ip}"):
        attempts = await redis_client.incr(key)
        if attempts == 1:
            await redis_client.expire(key, LOCKOUT_SECONDS)

async def reset_failed_login(username: str, ip: str, redis_client):
    await redis_client.delete(f"failed_login:{username}")
    await redis_client.delete(f"failed_login_ip:{ip}")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> StaffUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    result = await db.execute(select(StaffUser).where(StaffUser.id == user_id))
    user = result.scalars().first()

    if user is None or not user.is_active:
        raise credentials_exception

    return user

def require_role(required_role: str):
    async def role_checker(current_user: StaffUser = Depends(get_current_user)) -> StaffUser:
        if current_user.role_name != required_role and current_user.role_name != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires '{required_role}' role"
            )
        return current_user
    return role_checker

require_admin = require_role("admin")
