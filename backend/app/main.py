import secrets

from fastapi import FastAPI, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.redis import get_redis
from app.logging_config import setup_logging
from app.auth.router import router as auth_router
from app.catalog.router import router as catalog_router
from app.orders.router import router as orders_router
from app.content.router import router as content_router
from app.search.router import router as search_router
from app.storage.router import router as storage_router
from app.commerce.router import router as commerce_router
from app.reviews.router import router as reviews_router

setup_logging()

app = FastAPI(
    title="LUCEA Enterprise API",
    version="1.0.0",
    # The interactive schema browsers are a reconnaissance aid, so they are
    # only mounted outside production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Defence in depth: the API sets its own headers rather than trusting the
    reverse proxy to be present on every deployment."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # API responses are per user and must never land in a shared cache. Media
    # is the exception: the storage key is a content address, so those bytes
    # never change and the handler sets its own long lived cache header.
    if request.url.path.startswith("/api/") and "/storage/media/" not in request.url.path:
        response.headers["Cache-Control"] = "no-store"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.on_event("startup")
async def startup_event():
    from app.database import engine, Base, AsyncSessionLocal
    from sqlalchemy.future import select
    from app.auth.models import StaffUser, Role
    from app.reviews.models import Review, NewsletterSubscriber  # noqa: F401, registers tables
    from app.auth.service import hash_password

    # Create tables, then apply additive column changes for models that grew
    # after the first deployment.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.schema_sync import sync_schema
    await sync_schema(engine)

    # Seed roles & default admin if missing
    async with AsyncSessionLocal() as db:
        roles_to_seed = ["admin", "editor", "fulfillment"]
        for r_name in roles_to_seed:
            r_res = await db.execute(select(Role).where(Role.name == r_name))
            if not r_res.scalars().first():
                db.add(Role(name=r_name, description=f"Default {r_name} role"))
        await db.commit()

        res = await db.execute(select(StaffUser).where(StaffUser.username == "admin"))
        if not res.scalars().first():
            admin_user = StaffUser(
                username="admin",
                email="admin@luceamaroc.com",
                password_hash=hash_password("AdminSecurePassword123!"),
                role_name="admin",
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("Default admin user and roles created successfully.")

        try:
            from seeds.seed import seed_data
            await seed_data()
        except Exception as e:
            print("Seed execution error:", e)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins, never a wildcard, because credentialed requests are allowed
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    max_age=600,
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(catalog_router, prefix="/api/v1/catalog", tags=["catalog"])
app.include_router(orders_router, prefix="/api/v1", tags=["orders"])
app.include_router(content_router, prefix="/api/v1", tags=["content"])
app.include_router(search_router, prefix="/api/v1/search", tags=["search"])
app.include_router(storage_router, prefix="/api/v1/storage", tags=["storage"])
app.include_router(commerce_router, prefix="/api/v1", tags=["commerce"])
app.include_router(reviews_router, prefix="/api/v1", tags=["reviews"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    db_ok = False
    try:
        await db.execute(select(1))
        db_ok = True
    except Exception:
        db_ok = False

    redis_ok = False
    try:
        await redis_client.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "ready" if (db_ok and redis_ok) else "degraded",
        "database": "ok" if db_ok else "unreachable",
        "redis": "ok" if redis_ok else "unreachable"
    }

@app.get("/metrics")
async def metrics_endpoint(request: Request):
    # Operational telemetry is not public data. When a scrape token is
    # configured, Prometheus must present it.
    if settings.METRICS_ALLOWED_TOKEN:
        provided = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        if not secrets.compare_digest(provided, settings.METRICS_ALLOWED_TOKEN):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    elif settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )

    metrics_data = (
        "# HELP http_requests_total Total number of HTTP requests\n"
        "# TYPE http_requests_total counter\n"
        'http_requests_total{method="GET",handler="/health"} 100\n'
        "# HELP system_up System status indicator\n"
        "# TYPE system_up gauge\n"
        "system_up 1\n"
    )
    return Response(content=metrics_data, media_type="text/plain")
