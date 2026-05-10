"""RAG pipeline: embedding + retrieval + generation."""
import os
import uuid
from contextlib import contextmanager
from typing import Generator, AsyncGenerator

import chromadb
from chromadb.config import Settings
from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────

MIMO_BASE_URL = os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1")
MIMO_MODEL   = os.getenv("MIMO_MODEL", "mimo-pro")
MIMO_EMBED   = os.getenv("MIMO_EMBED_MODEL", "text-embedding")
MIMO_API_KEY = os.getenv("MIMO_API_KEY", "")

# ── Chroma setup ──────────────────────────────────────────────────────────────

def _make_chroma():
    persist_dir = os.getenv("CHROMA_PERSIST_DIR", "/tmp/chroma_db")
    os.makedirs(persist_dir, exist_ok=True)
    return chromadb.Client(Settings(
        persist_directory=persist_dir,
        anonymized_telemetry=False,
    ))

@contextmanager
def get_chroma_collection(name: str = "mimo_docs"):
    client = _make_chroma()
    coll = client.get_or_create_collection(name=name)
    try:
        yield coll
    finally:
        pass  # client lives as long as the process


# ── Embedding helper ───────────────────────────────────────────────────────────

def _get_openai_client() -> OpenAI:
    if not MIMO_API_KEY:
        raise RuntimeError("MIMO_API_KEY environment variable is not set")
    return OpenAI(
        api_key=MIMO_API_KEY,
        base_url=MIMO_BASE_URL,
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using MiMo embedding model."""
    client = _get_openai_client()
    resp = client.embeddings.create(
        model=MIMO_EMBED,
        input=texts,
    )
    return [item.embedding for item in resp.data]


# ── Indexing ──────────────────────────────────────────────────────────────────

def index_document(
    filename: str,
    file_path: str,
    collection_name: str = "mimo_docs",
) -> dict:
    from mimextract import extract_text_from_file, chunk_text

    doc_id = str(uuid.uuid4())
    all_chunks = []
    for page_text in extract_text_from_file(file_path, filename):
        all_chunks.extend(chunk_text(page_text))

    if not all_chunks:
        raise ValueError("No extractable text found in document")

    # Embed and upsert in batches
    batch_size = 20
    with get_chroma_collection(collection_name) as coll:
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i : i + batch_size]
            embeddings = embed_texts(batch)
            coll.upsert(
                ids=[f"{doc_id}_c{i+j}" for j in range(len(batch))],
                embeddings=embeddings,
                documents=batch,
                metadatas=[{"doc_id": doc_id, "filename": filename} for _ in batch],
            )

    return {"doc_id": doc_id, "chunks": len(all_chunks), "filename": filename}


# ── Retrieval ────────────────────────────────────────────────────────────────

def retrieve_chunks(
    query: str,
    collection_name: str = "mimo_docs",
    top_k: int = 5,
) -> list[dict]:
    query_emb = embed_texts([query])[0]
    with get_chroma_collection(collection_name) as coll:
        results = coll.query(query_embeddings=[query_emb], n_results=top_k)
    docs = results.get("documents", [[]])[0]
    dists = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[{}]])[0]
    return [
        {"text": doc, "score": 1 - dist, "chunk_id": results["ids"][0][i]}
        for i, (doc, dist, meta) in enumerate(zip(docs, dists, metadatas))
    ]


# ── Chat with RAG ─────────────────────────────────────────────────────────────

def build_rag_prompt(question: str, chunks: list[dict]) -> str:
    context = "\n\n".join(f"[{i+1}] {c['text']}" for i, c in enumerate(chunks))
    return (
        "You are a helpful assistant. Use the provided context to answer the user's question.\n"
        "If the context does not contain relevant information, say so.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )


async def stream_chat(
    question: str,
    doc_id: str | None = None,
    collection_name: str = "mimo_docs",
) -> AsyncGenerator[dict, None]:
    """Run RAG + stream MiMo response. Yields dicts with 'token', 'done', 'sources'."""
    chunks = retrieve_chunks(question, collection_name)
    prompt = build_rag_prompt(question, chunks)

    client = _get_openai_client()
    try:
        stream = client.chat.completions.create(
            model=MIMO_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            temperature=0.7,
            max_tokens=2048,
        )
    except Exception as e:
        yield {"token": "", "done": True, "error": str(e)}
        return

    first = True
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield {"token": delta, "done": False, "sources": chunks if first else []}
            first = False
    yield {"token": "", "done": True, "sources": chunks}