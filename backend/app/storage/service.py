"""Object storage for product and article imagery.

Two rules learned the hard way:

1. **The stored URL must be one a browser can resolve.** `MINIO_URL` is the
   internal compose hostname `http://minio:9000`, which the API can reach and a
   visitor's browser cannot. Writing that into `product_images.url` produced
   rows that looked correct in the database and rendered as broken images on
   every page. Images are therefore addressed by a **relative path served by
   this API**, `/api/v1/storage/media/<key>`, which is correct in development,
   behind nginx, and behind any future CDN, and keeps the storefront CSP at
   `img-src 'self'`.

2. **Never trust the client declared content type.** A browser usually sends
   `image/webp` for a .webp file, but not always, and any client can lie. The
   file signature is checked instead.
"""

import io
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status

from app.minio_client import get_minio_client

BUCKET_PRODUCTS = "products"
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB (Threat Model S-B6)

EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


def sniff_image_type(data: bytes) -> Optional[str]:
    """Returns the real MIME type from the file signature, or None.

    Magic bytes are the source of truth. The declared content type is a hint
    from the client and is not used for the decision.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def ensure_bucket_exists(bucket_name: str = BUCKET_PRODUCTS) -> None:
    try:
        client = get_minio_client()
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
    except Exception:
        # A missing bucket surfaces on the put below with a clearer message
        pass


def public_url(storage_key: str) -> str:
    """The path a browser uses. Relative on purpose, see the module docstring."""
    return f"/api/v1/storage/media/{storage_key}"


async def upload_product_image(file: UploadFile) -> Tuple[str, str]:
    """Validates, stores, and returns (public_path, storage_key)."""
    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier est vide.",
        )
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier depasse la taille maximale de 5 Mo.",
        )

    real_type = sniff_image_type(contents)
    if real_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non reconnu. Seuls les fichiers PNG, JPEG et WebP sont acceptes.",
        )

    # The filename is regenerated server side, so a crafted name cannot traverse
    # or collide (S-B6). The extension follows the sniffed type, not the upload.
    storage_key = f"{uuid.uuid4().hex}.{EXTENSIONS[real_type]}"

    try:
        client = get_minio_client()
        ensure_bucket_exists(BUCKET_PRODUCTS)
        client.put_object(
            bucket_name=BUCKET_PRODUCTS,
            object_name=storage_key,
            data=io.BytesIO(contents),
            length=len(contents),
            content_type=real_type,
        )
    except HTTPException:
        raise
    except Exception as exc:
        # Previously this fell back to a fake /assets/ path, so a storage outage
        # produced rows pointing at files that never existed. Failing loudly is
        # the only honest option.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stockage indisponible, le fichier n a pas ete enregistre ({exc.__class__.__name__}).",
        )

    return public_url(storage_key), storage_key


def fetch_image(storage_key: str) -> Tuple[bytes, str]:
    """Reads an object back for the media endpoint."""
    client = get_minio_client()
    response = None
    try:
        response = client.get_object(BUCKET_PRODUCTS, storage_key)
        data = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        return data, content_type
    finally:
        if response is not None:
            response.close()
            response.release_conn()


def delete_image_from_storage(object_name: str, bucket_name: str = BUCKET_PRODUCTS) -> None:
    try:
        client = get_minio_client()
        client.remove_object(bucket_name, object_name)
    except Exception:
        # The database row is already gone. An orphaned object is recoverable,
        # a dangling row is not, so this never raises.
        pass
