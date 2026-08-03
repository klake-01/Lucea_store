import pytest
from sqlalchemy.future import select
from app.catalog.models import Product, Variant
from app.commerce.models import Voucher
from app.orders.models import Order

@pytest.mark.asyncio
async def test_cart_add_and_totals(client, test_db):
    """Test adding item to cart and server-side integer total calculation"""
    p = Product(name="Nura Classic", slug="nura-cart-test", status="published")
    v = Variant(sku="NURA-20-CART", price_cents=35000, stock=10, size_attribute="20cm")
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    # 1. Create Cart
    cart_res = await client.post("/api/v1/cart")
    assert cart_res.status_code == 201
    cart_id = cart_res.json()["id"]

    # 2. Add Item to Cart
    add_res = await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 2, "config_text": "Anas"}
    )
    assert add_res.status_code == 200
    cart_data = add_res.json()
    assert len(cart_data["items"]) == 1
    assert cart_data["subtotal_cents"] == 70000 # 2 * 350.00 MAD
    # Delivery for Casablanca > 350 MAD is FREE (0 cents)
    assert cart_data["delivery_charge_cents"] == 0
    assert cart_data["total_cents"] == 70000

@pytest.mark.asyncio
async def test_custom_text_length_validation(client, test_db):
    """BR-3: Custom config text >15 chars must fail validation"""
    p = Product(name="Lamp Custom", slug="lamp-custom", status="published")
    v = Variant(sku="CUSTOM-VAR", price_cents=20000, stock=5)
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    cart_res = await client.post("/api/v1/cart")
    cart_id = cart_res.json()["id"]

    # 16 characters -> should fail validation
    long_text = "A" * 16
    fail_res = await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 1, "config_text": long_text}
    )
    assert fail_res.status_code == 422 # Pydantic validation error

@pytest.mark.asyncio
async def test_order_placement_stock_decrement_and_snapshotting(client, test_db):
    """Test full order placement, stock decrement, price snapshotting, and history tracking"""
    p = Product(name="Zellige Table Lamp", slug="zellige-lamp", status="published")
    v = Variant(sku="ZELL-30", price_cents=50000, stock=5, size_attribute="30cm") # 5 in stock
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    # Create Cart & Add Item
    cart_res = await client.post("/api/v1/cart")
    cart_id = cart_res.json()["id"]
    await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 2}
    )

    # Place Order
    order_res = await client.post(
        "/api/v1/orders",
        json={
            "cart_id": cart_id,
            "name": "Lina",
            "phone": "+212611223344",
            "city": "Rabat",
            "address_line": "Avenue Mohamed V",
            "payment_method": "COD"
        }
    )
    assert order_res.status_code == 201
    order_data = order_res.json()

    assert order_data["phone"] == "+212611223344"
    assert order_data["subtotal_cents"] == 100000 # 1,000 MAD
    assert order_data["status"] == "pending"
    assert len(order_data["items"]) == 1
    assert order_data["items"][0]["snapshotted_sku"] == "ZELL-30"
    assert order_data["items"][0]["snapshotted_price_cents"] == 50000
    assert len(order_data["status_history"]) >= 1

    # Placement RESERVES, it does not decrement. Physical stock only moves when
    # the goods leave, which under cash on delivery is at delivery. Reserving
    # at placement is what stops the same unit being sold twice while an order
    # is still open. See app/orders/inventory.py.
    res = await test_db.execute(select(Variant).where(Variant.id == v.id))
    updated_v = res.scalars().first()
    assert updated_v.stock == 5, "physical stock must not move before delivery"
    assert updated_v.reserved == 2, "the ordered units must be held"
    assert updated_v.available == 3, "available = stock - reserved"

    # Marking the order delivered is what commits the sale
    from app.orders.order_service import update_order_status_admin
    await update_order_status_admin(test_db, order_data["id"], "delivered")
    res = await test_db.execute(select(Variant).where(Variant.id == v.id))
    settled = res.scalars().first()
    assert settled.stock == 3, "delivery reduces physical stock"
    assert settled.reserved == 0, "delivery frees the reservation"

@pytest.mark.asyncio
async def test_cod_max_limit_enforcement(client, test_db):
    """BR-1: COD order over 5,000 MAD (500,000 cents) must be rejected"""
    p = Product(name="Luxury Chandelier", slug="luxury-chandelier", status="published")
    v = Variant(sku="LUX-CH", price_cents=600000, stock=2) # 6,000 MAD
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    cart_res = await client.post("/api/v1/cart")
    cart_id = cart_res.json()["id"]
    await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 1}
    )

    order_res = await client.post(
        "/api/v1/orders",
        json={
            "cart_id": cart_id,
            "name": "Rachid",
            "phone": "+212655443322",
            "city": "Casablanca",
            "address_line": "Bd Anfa",
            "payment_method": "COD"
        }
    )
    assert order_res.status_code == 400
    assert "5,000 MAD" in order_res.json()["detail"]

@pytest.mark.asyncio
async def test_order_ownership_check(client, test_db):
    """Getting order details with wrong phone number returns 403 Forbidden"""
    p = Product(name="Lamp Ownership Test", slug="lamp-own-test", status="published")
    v = Variant(sku="OWN-1", price_cents=25000, stock=5)
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    cart_res = await client.post("/api/v1/cart")
    cart_id = cart_res.json()["id"]
    await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 1}
    )

    order_res = await client.post(
        "/api/v1/orders",
        json={
            "cart_id": cart_id,
            "name": "Salma",
            "phone": "+212699887766",
            "city": "Marrakech",
            "address_line": "Gueliz",
            "payment_method": "COD"
        }
    )
    order_id = order_res.json()["id"]

    # Wrong phone -> 403 Forbidden
    forbidden_res = await client.get(f"/api/v1/orders/{order_id}?phone=+212600000000")
    assert forbidden_res.status_code == 403

    # Correct phone -> 200 OK
    correct_res = await client.get(f"/api/v1/orders/{order_id}?phone=+212699887766")
    assert correct_res.status_code == 200
    assert correct_res.json()["name"] == "Salma"

@pytest.mark.asyncio
async def test_idempotency_key(client, test_db):
    """Idempotency-Key header prevents duplicate orders on retry"""
    p = Product(name="Idempotency Lamp", slug="idemp-lamp", status="published")
    v = Variant(sku="IDEMP-1", price_cents=30000, stock=10)
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    cart_res = await client.post("/api/v1/cart")
    cart_id = cart_res.json()["id"]
    await client.post(
        "/api/v1/cart/items",
        params={"cart_id": cart_id},
        json={"variant_id": v.id, "quantity": 1}
    )

    headers = {"Idempotency-Key": "unique-request-key-12345"}
    payload = {
        "cart_id": cart_id,
        "name": "Test User",
        "phone": "+212612345678",
        "city": "Salé",
        "address_line": "Hay Salam",
        "payment_method": "COD"
    }

    # Request 1
    res1 = await client.post("/api/v1/orders", json=payload, headers=headers)
    assert res1.status_code == 201
    order1 = res1.json()

    # Request 2 (Duplicate retry)
    res2 = await client.post("/api/v1/orders", json=payload, headers=headers)
    assert res2.status_code == 200 or res2.status_code == 201
    order2 = res2.json()

    assert order1["id"] == order2["id"]
    assert order1["order_number"] == order2["order_number"]
