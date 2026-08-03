from datetime import datetime, timedelta, timezone

import pytest


async def admin_token(client) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_voucher_accepts_timezone_aware_dates(client):
    """Regression: the admin sends new Date(...).toISOString(), which carries a
    Z suffix. Pydantic then produces a timezone aware datetime while every
    timestamp column here is naive, which made asyncpg reject the insert with a
    500. Dates must be normalised to naive UTC at the schema boundary."""
    token = await admin_token(client)

    res = await client.post(
        "/api/v1/admin/vouchers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "code_prefix": "TZ",
            "discount_type": "percentage",
            "value": 15,
            "valid_from": "2026-08-01T09:00:00.000Z",
            "valid_until": "2026-09-01T09:00:00.000Z",
            "usage_limit": 10,
        },
    )

    assert res.status_code == 201, res.text
    body = res.json()
    # Stored and returned without an offset, so later comparisons against
    # datetime.utcnow() cannot raise.
    assert body["valid_from"].endswith("09:00:00")
    assert "+" not in body["valid_from"]
    assert body["status"] == "scheduled"


@pytest.mark.asyncio
async def test_voucher_percentage_cap_applies(client):
    token = await admin_token(client)
    res = await client.post(
        "/api/v1/admin/vouchers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "code": "CAPTEST",
            "discount_type": "percentage",
            "value": 50,
            "max_discount_cents": 5000,
            "usage_limit": 10,
        },
    )
    assert res.status_code == 201, res.text

    from app.commerce.models import Voucher
    from app.commerce.service import compute_discount

    voucher = Voucher(
        code="CAPTEST", discount_type="percentage", value=50,
        max_discount_cents=5000, min_order_cents=0, usage_count=0, usage_limit=10,
        active_status=True, valid_from=datetime.utcnow() - timedelta(days=1),
    )
    # 50 percent of 40000 is 20000, the cap must bring it down to 5000
    discount, delivery, reason = compute_discount(voucher, 40000, 2000)
    assert discount == 5000
    assert reason is None


@pytest.mark.asyncio
async def test_voucher_never_exceeds_the_basket(client):
    """A fixed code larger than the goods must not produce a negative total."""
    from app.commerce.models import Voucher
    from app.commerce.service import compute_discount

    voucher = Voucher(
        code="BIG", discount_type="fixed_cents", value=99999, min_order_cents=0,
        usage_count=0, usage_limit=10, active_status=True,
        valid_from=datetime.utcnow() - timedelta(days=1),
    )
    discount, delivery, reason = compute_discount(voucher, 30000, 2000)
    assert discount == 30000
    assert reason is None


@pytest.mark.asyncio
async def test_expired_and_minimum_are_refused_with_a_reason(client):
    from app.commerce.models import Voucher
    from app.commerce.service import compute_discount

    expired = Voucher(
        code="OLD", discount_type="percentage", value=10, min_order_cents=0,
        usage_count=0, usage_limit=10, active_status=True,
        valid_from=datetime.utcnow() - timedelta(days=30),
        valid_until=datetime.utcnow() - timedelta(days=1),
    )
    discount, _, reason = compute_discount(expired, 30000, 2000)
    assert discount == 0 and "expire" in reason.lower()

    too_small = Voucher(
        code="MIN", discount_type="percentage", value=10, min_order_cents=50000,
        usage_count=0, usage_limit=10, active_status=True,
        valid_from=datetime.utcnow() - timedelta(days=1),
    )
    discount, _, reason = compute_discount(too_small, 30000, 2000)
    assert discount == 0 and "minimum" in reason.lower()


@pytest.mark.asyncio
async def test_free_shipping_zeroes_delivery_only(client):
    from app.commerce.models import Voucher
    from app.commerce.service import compute_discount

    voucher = Voucher(
        code="LIVRAISON", discount_type="free_shipping", value=0, min_order_cents=0,
        usage_count=0, usage_limit=10, active_status=True,
        valid_from=datetime.utcnow() - timedelta(days=1),
    )
    discount, delivery, reason = compute_discount(voucher, 30000, 3500)
    assert discount == 0
    assert delivery == 0
    assert reason is None


@pytest.mark.asyncio
async def test_generated_codes_avoid_ambiguous_characters():
    from app.commerce.service import generate_code

    for _ in range(50):
        body = generate_code("SOLDES").split("-")[-1]
        # A customer reads these off a screen, so O/0 and I/1 are excluded
        assert not set(body) & set("O0I1")
