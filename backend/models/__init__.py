import hashlib
from pathlib import Path


def _checksum(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def write_checksum(path: Path) -> None:
    Path(str(path) + ".sha256").write_text(_checksum(path))


def verify_checksum(path: Path) -> bool:
    sha_path = Path(str(path) + ".sha256")
    if not sha_path.exists():
        return True  # no sidecar yet — trust existing files
    return _checksum(path) == sha_path.read_text().strip()
