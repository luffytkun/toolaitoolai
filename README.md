# MiMo RAG Chatbot

A Retrieval-Augmented Generation chatbot powered by Xiaomi MiMo API.

## Quick Start (Local)

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
export MIMO_API_KEY=your_key_here
export MIMO_BASE_URL=https://api.xiaomimimo.com/v1
uvicorn main:app --reload

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deploy

### Backend — Railway

```bash
railway login
cd backend
railway init
railway add --variable MIMO_API_KEY=your_key
railway deploy
```

Set these environment variables in Railway dashboard:
- `MIMO_API_KEY` = your MiMo key
- `MIMO_BASE_URL` = https://api.xiaomimimo.com/v1
- `MIMO_MODEL` = mimo-pro
- `MIMO_EMBED_MODEL` = text-embedding
- `CHROMA_PERSIST_DIR` = /data

Then update `frontend/.env`:
```
VITE_API_URL=https://your-railway-app.railway.app
```

### Frontend — Vercel

```bash
cd frontend
vercel --prod
```

## Features

- PDF + TXT document upload and indexing
- ChromaDB vector search (top-5 chunks)
- Streaming responses via SSE
- Dark-themed chat UI