import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base, get_db
from app.redis import get_redis
from app.main import app
from app.auth.models import Role, StaffUser
from app.auth.service import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

class FakeRedis:
    def __init__(self):
        self.store = {}
        self.sets = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str, ex=None):
        self.store[key] = str(value)

    async def delete(self, key: str):
        self.store.pop(key, None)
        self.sets.pop(key, None)

    async def incr(self, key: str):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    async def expire(self, key: str, seconds: int):
        pass

    # Set operations back the per user refresh token index, which lets a
    # password reset revoke every session at once.
    async def sadd(self, key: str, *values: str):
        bucket = self.sets.setdefault(key, set())
        before = len(bucket)
        bucket.update(str(v) for v in values)
        return len(bucket) - before

    async def smembers(self, key: str):
        return set(self.sets.get(key, set()))

    async def srem(self, key: str, *values: str):
        bucket = self.sets.get(key)
        if not bucket:
            return 0
        removed = 0
        for value in values:
            if str(value) in bucket:
                bucket.discard(str(value))
                removed += 1
        return removed

    async def ping(self):
        return True

    def reset(self):
        self.store.clear()
        self.sets.clear()

fake_redis = FakeRedis()


@pytest.fixture(autouse=True)
def clean_redis():
    """Rate limit counters and tokens must not leak between tests."""
    fake_redis.reset()
    yield
    fake_redis.reset()

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def test_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Seed test admin & editor user
        admin_role = Role(name="admin", description="Admin role")
        editor_role = Role(name="editor", description="Editor role")
        session.add_all([admin_role, editor_role])
        await session.commit()

        admin_user = StaffUser(
            id="test-admin-id",
            username="testadmin",
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            role_name="admin",
            is_active=True
        )
        editor_user = StaffUser(
            id="test-editor-id",
            username="testeditor",
            email="editor@test.com",
            password_hash=hash_password("EditorPass123!"),
            role_name="editor",
            is_active=True
        )
        session.add_all([admin_user, editor_user])
        await session.commit()

        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(test_db):
    fake_redis.store.clear()

    async def _get_test_db():
        yield test_db

    async def _get_test_redis():
        return fake_redis

    app.dependency_overrides[get_db] = _get_test_db
    app.dependency_overrides[get_redis] = _get_test_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
