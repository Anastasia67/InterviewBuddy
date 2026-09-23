# InterviewBuddy
AI Social Anxiety Interview Trainer

App Name: Steady

## Running locally

### Prerequisites
- Python 3.9+
- Node.js + npm
- [Ollama](https://ollama.com) with the `llama3` model pulled:
  ```bash
  ollama pull llama3
  ```

### 1. Start Ollama
```bash
ollama serve   # skip if already running; check with `ollama list`
```

### 2. Start the backend (FastAPI)
```bash
cd backend
python3 -m venv venv        # first time only
source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn app:app --reload --port 8000
```
Backend runs at http://127.0.0.1:8000.

### 3. Start the frontend (Vite)
```bash
cd frontend/interview_buddy
npm install       # first time only
npm run dev
```
Vite will print a local URL, typically **http://localhost:5173**. Open that in your browser.

### Notes
- The frontend talks to the backend at `http://127.0.0.1:8000` (see `frontend/interview_buddy/src/api.js`). It's pinned to `127.0.0.1` rather than `localhost` because on some machines `localhost` resolves to the IPv6 loopback (`::1`) first, and the backend only listens on IPv4 — that mismatch causes `ERR_CONNECTION_REFUSED` in the browser even though the backend is running.
- If port 5173 is already in use, Vite will pick the next free port (e.g. 5174) — check your terminal output for the actual URL.