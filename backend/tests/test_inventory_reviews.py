"""Regression cover for the reservation model and review routing.

Both were added after the storefront shipped, and both are the kind of logic
that breaks silently: stock drifts by one unit per order, or a one star review
quietly appears on the home page.
"""

import pytest
from sqlalchemy.future import select

from app.catalog.models import Product, Variant
from app.orders.inventory import available_units
from app.orders.order_service import update_order_status_admin


async def _seed_variant(test_db, sku="INV-1", stock=10, price=20000):
    product = Product(name="Lampe Inventaire", slug=f"lampe-{sku.lower()}",
                      description="Test", brand="LUCEA", status="published")
    test_db.add(product)
    await test_db.flush()
    variant = Variant(product_id=product.id, sku=sku, price_cents=price, stock=stock)
    test_db.add(variant)
    await test_db.commit()
    await test_db.refresh(variant)
    return product, variant


async def _place(client, variant_id, qty=2, phone="0600112233"):
    cart = (await client.post("/api/v1/cart")).json()
    await client.post(f"/api/v1/cart/items?cart_id={cart['id']}",
                      json={"variant_id": variant_id, "quantity": qty})
    return (await client.post("/api/v1/orders", json={
        "cart_id": cart["id"], "name": "Client Inventaire", "phone": phone,
        "city": "Casablanca", "address_line": "Rue du Stock 1", "payment_method": "COD",
    })).json()


@pytest.mark.asyncio
async def test_placement_reserves_without_touching_stock(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-RESERVE")
    await _place(client, variant.id, qty=3)

    await test_db.refresh(variant)
    assert variant.stock == 10, "physical stock must not move before delivery"
    assert variant.reserved == 3
    assert available_units(variant) == 7


@pytest.mark.asyncio
async def test_delivery_commits_the_sale(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-DELIVER")
    order = await _place(client, variant.id, qty=2)

    await update_order_status_admin(test_db, order["id"], "delivered")
    await test_db.refresh(variant)
    assert variant.stock == 8, "delivery is what reduces physical stock"
    assert variant.reserved == 0, "the reservation is consumed by the sale"


@pytest.mark.asyncio
async def test_delivering_twice_does_not_double_decrement(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-TWICE")
    order = await _place(client, variant.id, qty=2)

    await update_order_status_admin(test_db, order["id"], "delivered")
    await update_order_status_admin(test_db, order["id"], "delivered")

    await test_db.refresh(variant)
    assert variant.stock == 8, "stock_state makes the transition idempotent"


@pytest.mark.asyncio
async def test_cancelling_releases_the_hold(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-CANCEL")
    order = await _place(client, variant.id, qty=4)

    await update_order_status_admin(test_db, order["id"], "cancelled")
    await test_db.refresh(variant)
    assert variant.stock == 10, "a refused parcel never left the workshop"
    assert variant.reserved == 0, "the hold is released"
    assert available_units(variant) == 10


@pytest.mark.asyncio
async def test_return_puts_delivered_goods_back(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-RETURN")
    order = await _place(client, variant.id, qty=2)

    await update_order_status_admin(test_db, order["id"], "delivered")
    await update_order_status_admin(test_db, order["id"], "returned")

    await test_db.refresh(variant)
    assert variant.stock == 10, "returned goods come back on the shelf"


@pytest.mark.asyncio
async def test_reserved_units_cannot_be_sold_twice(client, test_db):
    _, variant = await _seed_variant(test_db, sku="INV-HOLD", stock=2)
    await _place(client, variant.id, qty=2, phone="0600112244")

    cart = (await client.post("/api/v1/cart")).json()
    res = await client.post(f"/api/v1/cart/items?cart_id={cart['id']}",
                            json={"variant_id": variant.id, "quantity": 1})
    assert res.status_code == 400, "units held by an open order are not sellable"


# ------------------------------------------------------------------ reviews

REVIEW_BODY = "La finition est vraiment soignee et la lumiere est douce le soir."


@pytest.mark.asyncio
async def test_high_rating_publishes_immediately(client):
    res = await client.post("/api/v1/reviews", json={
        "rating": 5, "body": REVIEW_BODY, "author_name": "Imane B",
    })
    assert res.status_code == 201

    public = (await client.get("/api/v1/reviews")).json()
    assert any(r["body"] == REVIEW_BODY for r in public["items"])


@pytest.mark.asyncio
async def test_low_rating_is_held_for_a_human(client):
    body = "Le colis est arrive en retard et la gravure comportait une faute."
    res = await client.post("/api/v1/reviews", json={
        "rating": 2, "body": body, "author_name": "Mehdi T",
        "author_phone": "0600998877",
    })
    assert res.status_code == 201

    public = (await client.get("/api/v1/reviews")).json()
    assert not any(r["body"] == body for r in public["items"]), \
        "a 2 star review must not reach the storefront unreviewed"


@pytest.mark.asyncio
async def test_three_stars_is_held_too(client):
    """Three is the boundary. The brief said under 3 goes to moderation and 4
    and above publishes, which leaves 3 ambiguous. It is held, because the
    safe direction on an ambiguous rule is the one a human can undo."""
    body = "La lampe est correcte mais la livraison a pris plus de temps que prevu."
    await client.post("/api/v1/reviews", json={
        "rating": 3, "body": body, "author_name": "Sara M",
    })
    public = (await client.get("/api/v1/reviews")).json()
    assert not any(r["body"] == body for r in public["items"])


@pytest.mark.asyncio
async def test_public_payload_never_exposes_contact_details(client):
    await client.post("/api/v1/reviews", json={
        "rating": 5, "body": REVIEW_BODY, "author_name": "Youssef K",
        "author_email": "youssef@example.com", "author_phone": "0600112255",
    })
    public = (await client.get("/api/v1/reviews")).json()
    for review in public["items"]:
        assert "author_email" not in review
        assert "author_phone" not in review


@pytest.mark.asyncio
async def test_admin_can_publish_a_held_review(client):
    body = "Probleme de livraison resolu apres un appel du service client."
    await client.post("/api/v1/reviews", json={
        "rating": 2, "body": body, "author_name": "Karim L",
    })

    login = await client.post("/api/v1/auth/login", json={
        "username_or_email": "testadmin", "password": "AdminPass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    admin_list = (await client.get("/api/v1/admin/reviews?status=pending",
                                   headers=headers)).json()
    target = next(r for r in admin_list["items"] if r["body"] == body)

    res = await client.put(f"/api/v1/admin/reviews/{target['id']}",
                           json={"status": "published"}, headers=headers)
    assert res.status_code == 200

    public = (await client.get("/api/v1/reviews")).json()
    assert any(r["body"] == body for r in public["items"])


@pytest.mark.asyncio
async def test_newsletter_capture_is_idempotent_and_normalised(client):
    a = await client.post("/api/v1/newsletter/subscribe",
                          json={"email": "Test.Client@Example.COM"})
    b = await client.post("/api/v1/newsletter/subscribe",
                          json={"email": "test.client@example.com"})
    assert a.status_code == 201 and b.status_code == 201

    login = await client.post("/api/v1/auth/login", json={
        "username_or_email": "testadmin", "password": "AdminPass123!",
    })
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    subs = (await client.get("/api/v1/admin/subscribers", headers=headers)).json()

    emails = [s["email"] for s in subs["items"]]
    assert emails.count("test.client@example.com") == 1, "stored once, lower cased"
