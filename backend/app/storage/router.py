import re

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response, status

from app.auth.dependencies import require_role
from app.auth.models import StaffUser
from app.storage.service import (
    upload_product_image, delete_image_from_storage, fetch_image
)

router = APIRouter()

# Keys are generated server side as <32 hex>.<ext>. Validating the shape here
# means a crafted key can never be used to reach another object or traverse.
KEY_PATTERN = re.compile(r"^[a-f0-9]{32}\.(png|jpg|webp)$")


@router.get("/media/{storage_key}")
async def get_media(storage_key: str):
    """Serves an uploaded image from the API's own origin.

    Images are not linked directly to MinIO because `MINIO_URL` is the internal
    compose hostname, which a browser cannot resolve. Going through the API also
    keeps the storefront CSP at `img-src 'self'` and means no bucket has to be
    made public.
    """
    if not KEY_PATTERN.match(storage_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Introuvable")

    try:
        data, content_type = fetch_image(storage_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Introuvable")

    return Response(
        content=data,
        media_type=content_type,
        headers={
            # The key is effectively a content address: a new upload gets a new
            # key, so the bytes behind a key never change and can be cached hard.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _: StaffUser = Depends(require_role("editor"))
):
    image_url, storage_key = await upload_product_image(file)
    return {"url": image_url, "storage_key": storage_key}


@router.delete("/delete/{filename}")
async def delete_file(
    filename: str,
    _: StaffUser = Depends(require_role("editor"))
):
    if not KEY_PATTERN.match(filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cle invalide")
    delete_image_from_storage(filename)
    return {"message": f"File {filename} deleted"}
