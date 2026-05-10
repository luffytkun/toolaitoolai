# MiMo RAG Chatbot — Specification

## 1. Project Overview

**Name**: MiMo RAG Chatbot  
**Type**: Retrieval-Augmented Generation web app  
**Summary**: A chat interface that answers questions by retrieving relevant context from a PDF/document knowledge base and generating responses via Xiaomi MiMo API.  
**Target users**: Developers evaluating MiMo API for AI-driven RAG workflows.

---

## 2. Functionality

### 2.1 Document Upload & Indexing
- User uploads a PDF or TXT file (max 10MB, max 100 pages)
- Backend extracts text, chunks it (~500 chars, 50-char overlap)
- Chunks are embedded via MiMo embedding model, stored in ChromaDB (in-memory, persist to `/data`)
- On page reload, existing index is reloaded from `/data` if present

### 2.2 Chat
- User types a question; frontend sends to `/api/chat`
- Backend embeds the query, retrieves top-5 chunks from ChromaDB
- Chunks are injected into prompt as context; request sent to MiMo chat completions API
- Streaming response (SSE) sent back to frontend and rendered in real-time

### 2.3 History
- Chat history stored in memory (list of `{role, content}` per session)
- No persistence between server restarts (stateless)

### 2.4 Endpoints
```
POST /api/upload     — multipart PDF/TXT upload → returns doc_id
POST /api/chat       — {question, doc_id?} → SSE stream
GET  /api/health     — 200 OK
```

---

## 3. Tech Stack

| Layer      | Technology                              |
|------------|------------------------------------------|
| Backend    | Python 3.11, FastAPI, Uvicorn           |
| Embedding  | MiMo API (`mimo-pro` model, text-embedding) |
| LLM        | MiMo API (`mimo-pro` model, chat completions) |
| Vector DB  | ChromaDB (client, in-process)           |
| Frontend   | React 18, Vite, TailwindCSS             |
| Deploy     | Railway (backend) + Vercel (frontend)   |

---

## 4. Environment Variables

```env
MIMO_API_KEY=       # MiMo API key from platform.xiaomimimo.com
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-pro
MIMO_EMBED_MODEL=text-embedding
PORT=8000
```

---

## 5. Backend — API Specification

### `POST /api/upload`
- **Input**: `multipart/form-data` with field `file` (PDF or TXT)
- **Process**: extract text → chunk → embed → upsert to ChromaDB collection `mimo_docs`
- **Output**: `{"doc_id": "<uuid>", "chunks": N, "filename": "..."}`

### `POST /api/chat`
- **Input**: `{"question": string, "doc_id"?: string}`
- **Process**: embed query → retrieve top-5 chunks → build prompt → stream from MiMo
- **Output**: SSE stream of `data: {...}\n\n`
  - `token`: incremental token string
  - `done`: boolean
  - `sources`: array of `{text, chunk_id, score}`

### `GET /api/health`
- **Output**: `{"status": "ok", "docs_indexed": N}`

---

## 6. Frontend — UI Specification

- **Single page** at `/`
- **Header**: logo "MiMo RAG Chat", API status badge (connected/disconnected)
- **Upload panel** (left/top on mobile): drag-and-drop zone, file list, "Index" button
- **Chat panel** (right/bottom): message bubbles (user = right-aligned, assistant = left-aligned), input bar at bottom, streaming spinner during response
- **Styling**: dark theme (GitHub dark palette), rounded messages, monospace code blocks

---

## 7. File Structure

```
mimo-rag-chatbot/
├── SPEC.md
├── backend/
│   ├── main.py           # FastAPI app
│   ├── rag.py            # RAG pipeline (chroma, embedding, retrieval)
│   ├── mimextract.py      # PDF/TXT extraction
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/ChatPanel.jsx
│   │   ├── components/UploadPanel.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 8. Acceptance Criteria

- [ ] Upload PDF → text extracted → chunks indexed in ChromaDB
- [ ] Ask question → relevant context retrieved → answer streamed via SSE
- [ ] API key not set → graceful error message shown in UI
- [ ] App builds and runs via Docker (`docker compose up`)
- [ ] Frontend connects to backend at `import.meta.env.VITE_API_URL`