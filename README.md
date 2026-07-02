# AI-Proctored Adaptive Interview Simulator

An advanced, AI-powered platform where candidates practice technical interviews under realistic, proctored conditions. It features adaptive questioning, real-time evaluation, audio analytics, and behavioral integrity monitoring.

---

## 🚀 Key Features

### 💻 Cyber-Themed Interactive Landing Page
- **Diagnostic Terminal Console:** Sandbox console simulating terminal outputs, hardware calibration logs, and network handshakes.
- **Gaze Tracking Sandbox:** Simulated eye-tracking module demonstrating MediaPipe face mesh coordinates in real-time.
- **Audio Baseline Visualizer:** Responsive audio frequency waves utilizing the Web Audio API to verify microphone configurations.

### 🧠 Dual-Agent Intelligence Pipeline
- **Adaptive Interviewer Agent:** Dynamically tailors questions based on candidate performance. Integrated with **Anthropic Claude, OpenAI GPT, Google Gemini, Groq (Llama), and Ollama (Local)** models.
- **Technical Evaluator Agent:** Automatically grades candidate transcripts against a structured rubric (evaluating definition accuracy, mechanisms explained, code edge cases, and missing concepts).

### 🎙️ Advanced Speech & Audio Analytics
- **OpenAI Whisper-1 Transcription:** Automatic conversion of candidate audio recordings into structured text with word-level timestamps.
- **Speech Metrics Analyzer:** Tracks Words Per Minute (WPM) flow, filler word occurrences (e.g., "uh", "um", "like"), and longest pause durations to measure candidate confidence.

### 🛡️ Real-Time Proctoring & Signal Integrity
- **MediaPipe Face Mesh:** In-browser face and gaze detection calculating orientation vectors locally.
- **WebSocket Streaming:** Real-time push notifications of proctoring events:
  - Gaze deviations (looking off-screen)
  - Head pose deviations (looking away)
  - Missing faces / Multiple faces detection
  - Tab switching or exiting fullscreen mode
- **Integrity Score:** Real-time grading of candidate focus and compliance.

### 🎨 State-of-the-Art UX/UI
- **Cyber-Themed Dashboard:** Dark-mode interface powered by React 19, Framer Motion, and Tailwind CSS.
- **Command Palette:** Keyboard accessibility menu triggered globally by `Ctrl + K`.
- **Dynamic Floating Island:** Apple-style interactive notification widget alerting users to telemetry/proctoring updates.

---

## 🛠️ Architecture & Tech Stack

```
AI-Proctored Interview Simulator
├── frontend/             → React 18 Classic Frontend Dashboard
├── frontend2/            → React 19 Cyber-Themed Frontend Dashboard (Recommended)
├── backend/              → Express + TypeScript + SQLite3 API server & WebSocket Manager
└── docker-compose.yml    → Legacy PostgreSQL & Redis containers (Optional)
```

- **Frontend:** React 19, Vite, Tailwind CSS, Zustand, Recharts, Framer Motion, Lucide Icons, MediaPipe FaceMesh.
- **Backend:** Node.js, Express, TypeScript, SQLite3 (`sqlite`), WebSockets (`ws`).
- **AI Services:** OpenAI SDK, Anthropic SDK, Native fetch (Gemini / Groq), Vector Memory for contextual follow-up questions.

---

## ⚙️ Environment Configuration

Create a `.env` file in the workspace root by copying `.env.example`:

```bash
# General
PORT=8000
JWT_SECRET=your_super_secret_jwt_key
JWT_ALGORITHM=HS256

# Database & Redis (Defaults to SQLite in backend/interview.db)
DATABASE_URL=sqlite:./interview.db
REDIS_URL=redis://localhost:6379

# AI Keys (Configure any of the following to activate active models)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OLLAMA_HOST=http://localhost:11434

# Provider & Model Settings
DEFAULT_LLM_PROVIDER=gemini # Fallback provider (gemini, openai, anthropic, groq, ollama, mock)
DEFAULT_LLM_MODEL=gemini-1.5-flash
SYSTEM_KEY_USAGE_LIMIT=30
```

---

## 📥 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm** or **yarn**
- **Docker Desktop** *(Optional - for legacy PostgreSQL/Redis)*

---

### 1. Backend Server Setup

The backend handles API routing, authentication, WebSocket management, speech analysis, and AI routing. It automatically runs SQLite tables and migrations when started.

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run database & start Express/WebSocket server (Hot-Reload)
npm run dev
```

The server will spin up on [http://localhost:8000](http://localhost:8000).

---

### 2. Frontend Setup (Cyber-Themed React 19)

We recommend using `frontend2` for the premium dark glassmorphism layout and full MediaPipe integration.

```bash
# Navigate to the premium frontend directory
cd frontend2

# Install dependencies
npm install

# Run Vite dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

*(If you wish to view the legacy layout, follow the same steps inside the `/frontend` directory).*

---

## 🧪 Testing

The backend includes comprehensive test suites written using Jest.

### Unit Tests
Tests for isolated services (Auth service, speech analyzer, integrity engine, weak topic tracker, vector memory).
```bash
cd backend
npm run test
```

### End-to-End integration Tests
Validates real-time WebSocket connectivity, API routes, database connections, and session loops.
```bash
cd backend
npm run test:e2e
```

---

## 📄 License

This project is licensed under the MIT License.
