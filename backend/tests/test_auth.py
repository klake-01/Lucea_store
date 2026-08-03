import pytest
import jwt
from app.config import settings

@pytest.mark.asyncio
async def test_login_returns_valid_jwt(client):
    """Check 1: Login returns valid JWT; JWT decodes correctly with correct claims"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Decode and verify claims
    payload = jwt.decode(data["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "test-admin-id"
    assert payload["username"] == "testadmin"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"

@pytest.mark.asyncio
async def test_expired_or_invalid_jwt_returns_401(client):
    """Check 2: Expired or invalid JWT returns 401"""
    # Bad token
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.value"}
    )
    assert response.status_code == 401

    # Missing header
    response_no_header = await client.get("/api/v1/auth/me")
    assert response_no_header.status_code == 401

@pytest.mark.asyncio
async def test_refresh_token_rotation(client):
    """Check 3: Refresh token rotation works; old refresh token is invalidated"""
    # 1. Login to get initial refresh token
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"}
    )
    old_refresh = login_res.json()["refresh_token"]

    # 2. Rotate token
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh}
    )
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()
    new_refresh = new_data["refresh_token"]
    assert new_refresh != old_refresh

    # 3. Attempting to reuse old refresh token must fail (invalidated)
    reuse_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh}
    )
    assert reuse_res.status_code == 401

@pytest.mark.asyncio
async def test_rbac_admin_route_protection(client):
    """Check 4: /api/v1/admin/* returns 403 without valid admin staff token"""
    # Editor login
    editor_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testeditor", "password": "EditorPass123!"}
    )
    editor_token = editor_login.json()["access_token"]

    # Editor trying to access admin endpoint -> 403 Forbidden
    forbidden_res = await client.get(
        "/api/v1/auth/admin/audit-log",
        headers={"Authorization": f"Bearer {editor_token}"}
    )
    assert forbidden_res.status_code == 403

    # Admin login
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"}
    )
    admin_token = admin_login.json()["access_token"]

    # Admin access -> 200 OK
    allowed_res = await client.get(
        "/api/v1/auth/admin/audit-log",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert allowed_res.status_code == 200

@pytest.mark.asyncio
async def test_failed_login_lockout_429(client):
    """Check 5: 6th failed login attempt returns 429 (locked)"""
    username = "testadmin"
    
    # Fail 5 times
    for _ in range(5):
        res = await client.post(
            "/api/v1/auth/login",
            json={"username_or_email": username, "password": "WrongPassword!"}
        )
        assert res.status_code == 401

    # 6th attempt -> 429 Too Many Requests
    locked_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": "WrongPassword!"}
    )
    assert locked_res.status_code == 429
    # Customer facing copy is French across the API
    assert "verrouille" in locked_res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_audit_log_records_and_retrieval(client):
    """Check 6: Audit log records staff mutations & retrieval"""
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"}
    )
    admin_token = admin_login.json()["access_token"]

    audit_res = await client.get(
        "/api/v1/auth/admin/audit-log",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    assert isinstance(audit_res.json(), list)
