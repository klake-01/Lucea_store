import secrets
import warnings

from pydantic_settings import BaseSettings

# A 32 byte key is the minimum for HS256 per RFC 7518 section 3.2
MIN_JWT_SECRET_LENGTH = 32

WEAK_SECRETS = {
    "supersecret",
    "secret",
    "changeme",
    "generate_a_random_secure_string_here_for_production",
    "test-jwt-secret-key-32-chars-long-minimum",
}


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"  # development | staging | production

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/lucea"
    # 16379 is the host-side port the compose file publishes; inside the
    # compose network this is overridden with redis://redis:6379/0. Only a
    # backend run directly on the host falls back to this value.
    REDIS_URL: str = "redis://localhost:16379/0"
    MINIO_URL: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "admin"
    MINIO_SECRET_KEY: str = "password123"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # Comma separated list of origins allowed to call the API with credentials
    CORS_ORIGINS: str = (
        "https://luceamaroc.com,https://www.luceamaroc.com,"
        "http://localhost:3000,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173"
    )

    # Restricts /metrics to the monitoring network. Empty means allow all,
    # which is only acceptable outside production.
    METRICS_ALLOWED_TOKEN: str = ""

    # Canonical origin. Every absolute URL the server emits (JSON-LD @id,
    # canonical, og:url, sitemap <loc>) is built from this, so a staging
    # deployment cannot leak production URLs into its own structured data.
    SITE_URL: str = "https://luceamaroc.com"
    BRAND_NAME: str = "LUCEA Maroc"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


def _validate_secret() -> None:
    """A weak signing key means anyone can mint an admin token, so this is
    fatal in production and loudly generated in development."""
    secret = settings.JWT_SECRET

    if settings.is_production:
        if not secret or len(secret) < MIN_JWT_SECRET_LENGTH or secret in WEAK_SECRETS:
            raise RuntimeError(
                "JWT_SECRET must be set to a unique random value of at least "
                f"{MIN_JWT_SECRET_LENGTH} characters when ENVIRONMENT=production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return

    if not secret or len(secret) < MIN_JWT_SECRET_LENGTH or secret in WEAK_SECRETS:
        settings.JWT_SECRET = secrets.token_urlsafe(48)
        warnings.warn(
            "JWT_SECRET was missing or too weak, a random development key was "
            "generated. Existing sessions are invalidated on every restart. "
            "Set a real JWT_SECRET before deploying.",
            RuntimeWarning,
            stacklevel=2,
        )


_validate_secret()
