import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple
import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_HOURS = 1

MIN_PASSWORD_LENGTH = 12


def generate_opaque_token() -> str:
    """Refresh and reset tokens are bearer secrets, so they come from a CSPRNG
    rather than uuid4, which is not designed to be unguessable."""
    return secrets.token_urlsafe(32)


def validate_password_strength(password: str) -> Optional[str]:
    """Returns an error message, or None when the password is acceptable."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caracteres."
    if not re.search(r"[a-z]", password):
        return "Le mot de passe doit contenir une minuscule."
    if not re.search(r"[A-Z]", password):
        return "Le mot de passe doit contenir une majuscule."
    if not re.search(r"\d", password):
        return "Le mot de passe doit contenir un chiffre."
    return None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, username: str, role_name: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "username": username,
        "role": role_name,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_urlsafe(16),
        "type": "access"
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def create_refresh_token(user_id: str, redis_client) -> str:
    token = generate_opaque_token()
    redis_key = f"refresh_token:{token}"
    ttl = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    await redis_client.set(redis_key, user_id, ex=ttl)
    # Indexed per user so a password reset can revoke every active session
    await redis_client.sadd(f"user_refresh_tokens:{user_id}", token)
    await redis_client.expire(f"user_refresh_tokens:{user_id}", int(ttl.total_seconds()))
    return token

async def revoke_all_refresh_tokens(user_id: str, redis_client) -> int:
    """Called after a password reset: every previously issued session dies."""
    index_key = f"user_refresh_tokens:{user_id}"
    tokens = await redis_client.smembers(index_key)
    for token in tokens or []:
        await redis_client.delete(f"refresh_token:{token}")
    await redis_client.delete(index_key)
    return len(tokens or [])

async def rotate_refresh_token(old_token: str, username: str, role_name: str, redis_client) -> Optional[Tuple[str, str]]:
    redis_key = f"refresh_token:{old_token}"
    user_id = await redis_client.get(redis_key)
    if not user_id:
        return None
    
    # Single use: the old token is burned before a new pair is issued, so a
    # replayed refresh token cannot mint a second live session.
    await redis_client.delete(redis_key)
    await redis_client.srem(f"user_refresh_tokens:{user_id}", old_token)

    # Create new pair
    new_access_token = create_access_token(user_id=user_id, username=username, role_name=role_name)
    new_refresh_token = await create_refresh_token(user_id=user_id, redis_client=redis_client)
    return new_access_token, new_refresh_token

async def revoke_refresh_token(token: str, redis_client):
    redis_key = f"refresh_token:{token}"
    user_id = await redis_client.get(redis_key)
    await redis_client.delete(redis_key)
    if user_id:
        await redis_client.srem(f"user_refresh_tokens:{user_id}", token)

async def generate_reset_token(email: str, redis_client) -> str:
    token = generate_opaque_token()
    redis_key = f"reset_token:{token}"
    ttl = timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    await redis_client.set(redis_key, email, ex=ttl)
    return token

async def verify_reset_token(token: str, redis_client) -> Optional[str]:
    redis_key = f"reset_token:{token}"
    email = await redis_client.get(redis_key)
    if email:
        await redis_client.delete(redis_key)
    return email

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
