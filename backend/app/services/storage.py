"""Safe handling of stored upload files (random names, never the client's path)."""
import contextlib
import uuid
from pathlib import Path

from app.config import get_settings


def save_upload(content: bytes, ext: str) -> str:
    upload_dir = get_settings().upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"{uuid.uuid4().hex}.{ext}"
    path.write_bytes(content)
    return str(path)


def delete_upload(stored_path: str | None) -> None:
    if not stored_path:
        return
    upload_dir = get_settings().upload_dir.resolve()
    with contextlib.suppress(OSError, ValueError):
        path = Path(stored_path).resolve()
        if upload_dir in path.parents and path.is_file():
            path.unlink()
