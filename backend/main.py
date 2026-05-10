"""FastAPI application — MiMo RAG Chatbot."""
import os
import tempfile
import chromadb
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from rag import index_document, stream_chat, get_chroma_collection, MIMO_API_KEY


# ── Lifespan — init Chroma on startup ──────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm-up: verify API key is set
    if not MIMO_API_KEY:
        print("WARNING: MIMO_API_KEY not set — /api/chat will return an error.")
    # Ensure Chroma collection exists
    with get_chroma_collection() as _:
        pass
    yield


app = FastAPI(title="MiMo RAG Chatbot API", version="1.0.0", lifespan=lifespan)

# ── Request / Response models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    doc_id: str | None = None   # optional filter; currently unused (global index)


class UploadResponse(BaseModel):
    doc_id: str
    chunks: int
    filename: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    try:
        with get_chroma_collection() as coll:
            count = coll.count()
        return JSONResponse({"status": "ok", "docs_indexed": count})
    except Exception as e:
        return JSONResponse({"status": "error", "detail": str(e)}, status_code=500)


@app.post("/api/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    if not MIMO_API_KEY:
        raise HTTPException(status_code=500, detail="MIMO_API_KEY is not configured on the server.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".pdf", ".txt"):
        raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported.")

    # Stream to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = index_document(file.filename or "upload", tmp_path)
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not MIMO_API_KEY:
        raise HTTPException(status_code=500, detail="MIMO_API_KEY is not configured on the server.")

    async def event_stream():
        try:
            async for msg in stream_chat(req.question, req.doc_id):
                yield f"data: {msg.model_dump_json()}\n\n"
        except Exception as e:
            yield f'data: {{"token":"","done":true,"error":"{e}"}}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── CORS (dev only) ────────────────────────────────────────────────────────────

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)