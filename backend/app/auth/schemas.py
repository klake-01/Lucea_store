from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class StaffUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    role_name: str
    is_active: bool
    created_at: datetime

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    staff_id: Optional[str]
    action: str
    target_table: str
    record_id: Optional[str]
    changes: Optional[dict] = None
    timestamp: datetime
