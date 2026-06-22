# AI-Proctored Adaptive Interview Simulator

An AI-powered platform where candidates practice technical interviews under realistic, proctored conditions with adaptive questioning, real-time evaluation, and behavioral integrity monitoring.

## Quick Start

### Prerequisites
- **Docker Desktop** (for PostgreSQL + Redis)
- **Python 3.11+**
- **Node.js 18+**

### 1. Start Infrastructure
```bash
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App
- Frontend: [http://localhost:5173](http://localhost:
)
- Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (async) |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API key (optional — mock mode works without it) |
| `JWT_SECRET` | Secret key for JWT tokens |

## Architecture

```
frontend/          → React 18 + Vite + Tailwind CSS + Zustand
backend/           → FastAPI + SQLAlchemy 2.0 + Alembic
docker-compose.yml → PostgreSQL 15 + Redis 7
```

## Week 1 Features (Current)
- ✅ JWT Authentication (register, login, refresh)
- ✅ Session creation with topic/difficulty/duration
- ✅ Adaptive Interviewer Agent (Claude / mock fallback)
- ✅ Technical Evaluator Agent with structured rubric
- ✅ Full interview loop (question → answer → evaluate → next question)
- ✅ Dashboard with session history and stats
- ✅ Premium dark UI with glassmorphism design

## License
MIT
