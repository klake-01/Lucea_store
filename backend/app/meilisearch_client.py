import meilisearch
from app.config import settings

client = meilisearch.Client(settings.MINIO_URL.replace("9000", "7700") if "7700" not in settings.MINIO_URL else settings.MINIO_URL, settings.MINIO_ACCESS_KEY)

def get_meilisearch_client():
    return meilisearch.Client("http://localhost:7700", "masterKey123")
