"""PDF / TXT text extraction."""
import re
from pathlib import Path
from typing import Generator


def extract_text_from_file(file_path: str, filename: str) -> Generator[str, None, None]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        yield from _extract_txt(file_path)
    elif suffix in (".pdf",):
        yield from _extract_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def _extract_txt(path: str) -> Generator[str, None, None]:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        yield f.read()


def _extract_pdf(path: str) -> Generator[str, None, None]:
    import pymupdf
    doc = pymupdf.open(path)
    for page in doc:
        text = page.get_text()
        # Remove excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        if text.strip():
            yield text
    doc.close()


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks."""
    if not text:
        return []
    tokens = text.split()
    chunks = []
    start = 0
    while start < len(tokens):
        end = start + chunk_size
        chunk = " ".join(tokens[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    return chunks