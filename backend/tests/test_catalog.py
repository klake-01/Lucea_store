import pytest
from app.catalog.models import Product, Category, Variant

@pytest.mark.asyncio
async def test_list_products_pagination(client, test_db):
    """Test public product listing with pagination and limit clamps"""
    # Seed 3 products
    cat = Category(slug="luminaires", name="Luminaires")
    test_db.add(cat)
    await test_db.commit()

    p1 = Product(name="Lamp 1", slug="lamp-1", status="published")
    p2 = Product(name="Lamp 2", slug="lamp-2", status="published")
    test_db.add_all([p1, p2])
    await test_db.commit()

    res = await client.get("/api/v1/catalog/products?page=1&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] >= 2
    assert len(data["items"]) >= 2

@pytest.mark.asyncio
async def test_get_product_by_slug(client, test_db):
    """Test getting single product by slug"""
    p = Product(name="Nura Classic", slug="nura-classic", status="published")
    v = Variant(sku="NURA-20", price_cents=35000, stock=10, size_attribute="20cm")
    p.variants.append(v)
    test_db.add(p)
    await test_db.commit()

    res = await client.get("/api/v1/catalog/products/nura-classic")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Nura Classic"
    assert len(data["variants"]) == 1
    assert data["variants"][0]["sku"] == "NURA-20"

@pytest.mark.asyncio
async def test_admin_create_update_delete_product(client, test_db):
    """Test Admin product CRUD operations with RBAC guards"""
    # 1. Login as editor (non-admin)
    editor_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testeditor", "password": "EditorPass123!"}
    )
    editor_token = editor_login.json()["access_token"]

    # 2. Attempt creation as editor -> 403 Forbidden
    forbidden_res = await client.post(
        "/api/v1/catalog/admin/products",
        headers={"Authorization": f"Bearer {editor_token}"},
        json={
            "name": "Unauthorized Lamp",
            "slug": "unauthorized-lamp",
            "brand": "LUCÉA",
            "status": "published",
            "variants": [{"sku": "UNAUTH-1", "price_cents": 10000, "stock": 5}]
        }
    )
    assert forbidden_res.status_code == 403

    # 3. Login as admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testadmin", "password": "AdminPass123!"}
    )
    admin_token = admin_login.json()["access_token"]

    # 4. Create product as admin -> 201 Created
    create_res = await client.post(
        "/api/v1/catalog/admin/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Zellige Table Lamp",
            "slug": "zellige-table-lamp",
            "brand": "LUCÉA",
            "status": "published",
            "variants": [{"sku": "ZELL-1", "price_cents": 55000, "stock": 8, "size_attribute": "30cm"}]
        }
    )
    assert create_res.status_code == 201
    prod_id = create_res.json()["id"]

    # 5. Update product as admin -> 200 OK
    update_res = await client.put(
        f"/api/v1/catalog/admin/products/{prod_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Zellige Table Lamp Updated"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Zellige Table Lamp Updated"

    # 6. Delete product as admin -> 204 No Content
    delete_res = await client.delete(
        f"/api/v1/catalog/admin/products/{prod_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert delete_res.status_code == 204

@pytest.mark.asyncio
async def test_search_endpoint(client, test_db):
    """Test search endpoint with DB fallback"""
    p = Product(name="Veilleuse Safi", slug="veilleuse-safi", description="Moroccan craft light", status="published")
    test_db.add(p)
    await test_db.commit()

    res = await client.get("/api/v1/search?q=Safi")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "Safi" in data[0]["name"]

@pytest.mark.asyncio
async def test_storage_upload_validation(client):
    """Test image upload validation rules (mime type check)"""
    editor_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testeditor", "password": "EditorPass123!"}
    )
    editor_token = editor_login.json()["access_token"]

    # Invalid file type -> 400 Bad Request
    invalid_file = ("script.exe", b"binarycontent", "application/x-msdownload")
    upload_res = await client.post(
        "/api/v1/storage/upload",
        headers={"Authorization": f"Bearer {editor_token}"},
        files={"file": invalid_file}
    )
    assert upload_res.status_code == 400
    # Validation is by file signature now, not the declared content type, so a
    # client that lies about the type is still refused.
    assert "Format non reconnu" in upload_res.json()["detail"]

    # Valid PNG image -> 200 OK
    valid_file = ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")
    valid_res = await client.post(
        "/api/v1/storage/upload",
        headers={"Authorization": f"Bearer {editor_token}"},
        files={"file": valid_file}
    )
    assert valid_res.status_code == 200
    assert "url" in valid_res.json()
