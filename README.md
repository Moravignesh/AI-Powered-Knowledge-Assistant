# 🧠 AI Knowledge Assistant

A full-stack web application that lets users upload documents (PDF, DOCX, TXT) and ask questions about their contents using AI. Built with **FastAPI**, **React**, **MySQL**, **ChromaDB**, and **OpenAI**.

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [AI Workflow Explanation](#ai-workflow-explanation)
- [Docker Deployment](#docker-deployment)

---

## ✨ Features

- 📄 **Document Management** — Upload PDF, DOCX, TXT files; view and delete them
- 🤖 **AI Question Answering** — Ask questions; get answers grounded only in your documents
- 🔍 **Semantic Search** — ChromaDB vector search finds the most relevant document sections
- 📡 **Streaming Responses** — Real-time token-by-token AI responses via SSE
- 📝 **Document Summarization** — One-click AI summary for any document
- 🔐 **JWT Authentication** — Secure register/login; each user sees only their own data
- 📊 **Analytics Dashboard** — Usage stats, active users, document breakdown charts
- 🗂️ **Conversation History** — All past Q&A stored with sources and metadata
- 🖼️ **OCR Support** — Scanned PDFs processed via Tesseract fallback

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  Auth │ Documents │ Chat (Streaming) │ History │ Analytics  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend                            │
│                                                              │
│  /auth  │  /documents  │  /chat  │  /analytics              │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │ Document     │   │ Vector Store │   │  AI Service     │ │
│  │ Processor    │──▶│  (ChromaDB)  │──▶│  (OpenAI GPT)   │ │
│  │ PDF/DOCX/TXT │   │  Embeddings  │   │  gpt-4o-mini    │ │
│  └──────────────┘   └──────────────┘   └─────────────────┘ │
└─────────────┬──────────────────────────────────────────────┘
              │
┌─────────────▼──────────────────────┐
│           MySQL Database            │
│  users │ documents │ conversations  │
└────────────────────────────────────┘
```

**Request Flow for a Question:**
1. User submits question → FastAPI `/chat/ask`
2. Backend searches ChromaDB for semantically similar chunks
3. Top-5 chunks assembled into context prompt
4. OpenAI GPT generates answer grounded in that context
5. Answer + source references saved to MySQL conversations table
6. Response returned (or streamed token-by-token via SSE)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11, FastAPI, Uvicorn |
| Database | MySQL 8.0 + SQLAlchemy ORM |
| Vector DB | ChromaDB (persistent, cosine similarity) |
| Embeddings | OpenAI `text-embedding-3-small` (or local `all-MiniLM-L6-v2`) |
| AI Model | OpenAI `gpt-4o-mini` |
| Auth | JWT (python-jose) + bcrypt passwords |
| File Processing | PyPDF2, python-docx, pytesseract (OCR) |
| Frontend | React 18, Vite, React Router v6 |
| State | Zustand |
| Styling | CSS Modules (custom design system) |
| Charts | Recharts |
| Streaming | Server-Sent Events (SSE) |
| Containerization | Docker + Docker Compose |

---

## 📁 Project Structure

```
ai-knowledge-assistant/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # Register, login, /me
│   │   │   ├── documents.py     # Upload, list, delete, summarize
│   │   │   ├── chat.py          # Ask, stream, history
│   │   │   └── analytics.py     # Dashboard data
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   └── security.py      # JWT + bcrypt helpers
│   │   ├── db/
│   │   │   └── database.py      # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── user.py          # User ORM model
│   │   │   ├── document.py      # Document ORM model
│   │   │   └── conversation.py  # Conversation ORM model
│   │   ├── schemas/
│   │   │   ├── auth.py          # Pydantic request/response schemas
│   │   │   ├── document.py
│   │   │   └── conversation.py
│   │   ├── services/
│   │   │   ├── document_processor.py  # Text extraction + chunking
│   │   │   ├── vector_store.py        # ChromaDB wrapper
│   │   │   └── ai_service.py          # OpenAI integration
│   │   └── main.py              # FastAPI app entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DocumentsPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── AnalyticsPage.jsx
│   │   ├── components/
│   │   │   └── Layout.jsx       # Sidebar + nav
│   │   ├── services/
│   │   │   └── api.js           # Axios + streaming helpers
│   │   ├── store/
│   │   │   └── authStore.js     # Zustand auth state
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css            # Global design tokens
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 20+
- MySQL 8.0 running locally (or Docker)
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

---

### Option A: Local Development (Recommended for VS Code)

#### 1. Clone and navigate

```bash
cd ai-knowledge-assistant
```

#### 2. MySQL Setup

Start MySQL and create the database:

```sql
CREATE DATABASE ai_knowledge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or with Docker (just MySQL):
```bash
docker run -d --name mysql-dev \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=ai_knowledge_db \
  -p 3306:3306 \
  mysql:8.0
```

#### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=mysql+pymysql://root:rootpassword@localhost:3306/ai_knowledge_db
SECRET_KEY=your-super-secret-key-at-least-32-characters-long
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

✅ API is live at: http://localhost:8000  
✅ Swagger docs at: http://localhost:8000/docs

#### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env
cp .env.example .env
# (default VITE_API_URL=http://localhost:8000 is fine for local dev)

# Start dev server
npm run dev
```

✅ App is live at: http://localhost:3000

---

### Option B: Docker Compose (Full Stack)

```bash
# From project root
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY

# Build and start everything
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- MySQL: localhost:3306

Stop:
```bash
docker-compose down
```

---

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql+pymysql://root:password@localhost:3306/ai_knowledge_db` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | *(must set)* |
| `OPENAI_API_KEY` | OpenAI API key | *(required for AI features)* |
| `CHROMA_PERSIST_DIR` | ChromaDB storage path | `./chroma_db` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `MAX_FILE_SIZE_MB` | Max upload size | `50` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry | `30` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |

---

## 📡 API Documentation

Full interactive docs available at **http://localhost:8000/docs** (Swagger UI).

### Authentication

```
POST /auth/register
POST /auth/login
GET  /auth/me
```

**Register:**
```json
POST /auth/register
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepass123",
  "full_name": "John Doe"
}
```

**Login:**
```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

Response includes `access_token`. Add to all subsequent requests:
```
Authorization: Bearer <access_token>
```

---

### Documents

```
POST   /documents/upload           Upload a file (multipart/form-data)
GET    /documents                  List user's documents
GET    /documents/{id}             Get single document
DELETE /documents/{id}             Delete document + embeddings
GET    /documents/{id}/summarize   AI-generated summary
```

**Upload example (curl):**
```bash
curl -X POST http://localhost:8000/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

**Document status values:**
- `processing` — text extraction and embedding in progress
- `ready` — document indexed and ready for Q&A
- `error` — processing failed (see `error_message`)

---

### Chat

```
POST  /chat/ask           Ask a question (standard response)
POST  /chat/ask/stream    Ask with streaming SSE response
GET   /chat/history       Conversation history (paginated)
DELETE /chat/history/{id} Delete a conversation
```

**Ask question:**
```json
POST /chat/ask
{
  "question": "What is the leave policy?",
  "document_ids": [1, 2]   // optional: filter to specific docs
}
```

**Streaming (SSE events):**
```
data: {"type": "sources", "sources": [...]}
data: {"type": "token", "content": "The "}
data: {"type": "token", "content": "leave "}
data: {"type": "done", "conversation_id": 42}
```

**History:**
```
GET /chat/history?page=1&limit=20
```

---

### Analytics

```
GET /analytics    Dashboard data (user stats + global stats)
```

---

## 🤖 AI Workflow Explanation

### 1. Document Ingestion Pipeline

```
Upload File
    │
    ▼
Text Extraction (by file type)
├── PDF  → PyPDF2 page-by-page extraction
│          └── OCR fallback via Tesseract if text < 100 chars
├── DOCX → python-docx (paragraphs + tables)
└── TXT  → encoding-aware read (UTF-8 → Latin-1 fallback)
    │
    ▼
Text Chunking
  • chunk_size = 1000 characters
  • overlap    = 200 characters
  • Smart boundary detection (sentence → paragraph → word)
    │
    ▼
Embedding Generation
  • OpenAI text-embedding-3-small (if API key set)
  • Fallback: sentence-transformers all-MiniLM-L6-v2 (local)
    │
    ▼
ChromaDB Storage
  • Cosine similarity index
  • Metadata: document_id, document_name, chunk_index, user_id
```

### 2. Question Answering Pipeline

```
User Question
    │
    ▼
Embed Question (same model as documents)
    │
    ▼
ChromaDB Similarity Search
  • Top-5 most relevant chunks retrieved
  • Filtered to user's documents only
  • Optional: filter to specific document IDs
    │
    ▼
Context Assembly
  [Source 1 - filename.pdf]
  <chunk text>
  ---
  [Source 2 - policy.docx]
  <chunk text>
    │
    ▼
OpenAI GPT-4o-mini
  System: "Answer ONLY from the provided context..."
  User:   context + question
    │
    ▼
Response + Sources saved to MySQL
    │
    ▼
Return to user (full or streamed)
```

### 3. Why This Approach Works

- **RAG (Retrieval-Augmented Generation)** prevents hallucinations — the model can only use provided context
- **Chunking with overlap** preserves context across boundaries
- **Cosine similarity** finds semantically similar content even if exact words differ
- **Per-user collections** in ChromaDB enforce data isolation
- **Low temperature (0.1)** keeps answers factual and deterministic

---

## 🔒 Security Design

- Passwords hashed with **bcrypt** (never stored in plaintext)
- JWT tokens signed with **HS256** and expire after 30 minutes
- All document/conversation queries filtered by `owner_id = current_user.id`
- ChromaDB queries filtered by `user_id` metadata field
- File uploads validated by extension AND content type
- File size limited (default 50MB)

---

## 🐛 Troubleshooting

**MySQL connection refused:**
```bash
# Check MySQL is running
mysql -u root -p -e "SHOW DATABASES;"
# Verify DATABASE_URL in .env matches your MySQL credentials
```

**"AI service not configured":**
```
Make sure OPENAI_API_KEY is set in backend/.env
Restart the backend after editing .env
```

**Document stuck in "processing":**
```bash
# Check backend logs for errors
uvicorn app.main:app --reload  # watch for errors in terminal
# Common cause: missing PDF library - pip install PyPDF2
```

**ChromaDB embedding errors:**
```bash
# If OpenAI key missing, local model downloads on first run (~90MB)
# Ensure internet access for first run, or pre-download:
pip install sentence-transformers
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

**Frontend can't reach backend:**
```
Check VITE_API_URL in frontend/.env matches backend URL
Ensure CORS_ORIGINS in backend/.env includes your frontend URL
```

---

## 📦 VS Code Recommended Extensions

Install these for the best development experience:

- **Python** (ms-python.python)
- **Pylance** (ms-python.vscode-pylance)
- **ES7+ React/Redux/React-Native snippets**
- **Prettier** (esbenp.prettier-vscode)
- **MySQL** (cweijan.vscode-mysql-client2)
- **REST Client** (humao.rest-client) — for testing APIs

---

## 🚢 Production Deployment Notes

1. Change `SECRET_KEY` to a random 64-char string
2. Set `DEBUG=False` in backend `.env`
3. Use environment variables instead of `.env` files
4. Add HTTPS (nginx reverse proxy + Let's Encrypt)
5. Set `ACCESS_TOKEN_EXPIRE_MINUTES` based on security requirements
6. Use managed MySQL (RDS, PlanetScale) for persistence
7. Mount ChromaDB and uploads to persistent volumes

---

## 📄 License

MIT
