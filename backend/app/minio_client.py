import io
from minio import Minio
from app.config import settings

def get_minio_client() -> Minio:
    # Strip http:// or https:// for Minio SDK host
    endpoint = settings.MINIO_URL.replace("http://", "").replace("https://", "")
    return Minio(
        endpoint=endpoint,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=False
    )
