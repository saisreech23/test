# LogSentry — AI-Powered Log Analysis Platform

A full-stack web application that allows SOC analysts to upload server log files, parse them, and view AI-powered threat analysis including anomaly detection, event timelines, and actionable security findings.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│ PostgreSQL │     │ Claude API  │
│  (Next.js)   │◀────│  (Express)   │◀────│            │     │  (Anthropic)│
│  Port 3000   │     │  Port 4000   │────▶│            │     │             │
└─────────────┘     └──────────────┘     └────────────┘     └─────────────┘
                           │                                       ▲
                           └───────────────────────────────────────┘
                              AI Analysis & Anomaly Detection
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS | Responsive SPA with login, upload, dashboard, analysis views |
| Backend | Express.js, TypeScript, Prisma ORM | REST API for auth, file upload, log parsing, analysis orchestration |
| Database | PostgreSQL 16 | Stores users, uploads, parsed log entries, and analysis results |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) | Anomaly detection, threat assessment, timeline & summary generation |
| Auth | JWT + bcrypt | Token-based authentication with password hashing |
| DevOps | Docker Compose | One-command local deployment |

## Log Format Supported

**Nginx/Apache Combined Log Format:**
```
192.168.1.1 - user [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 2326 "https://ref.com" "Mozilla/5.0..."
```

## How AI Is Used

This application uses the **Anthropic Claude API** in two specific places, both in [`backend/src/logs/analyzer.ts`](backend/src/logs/analyzer.ts):

### 1. Anomaly Detection (`detectAnomalies` function)
- **Pre-filtering (rule-based):** Entries are first screened with deterministic rules — high request rates, SQL injection patterns, path traversal, suspicious HTTP methods, off-hours activity, etc.
- **AI refinement:** Candidate anomalies are sent to Claude for expert analysis. The AI confirms/dismisses each flag, provides a human-readable explanation, and assigns a confidence score (0.0–1.0).
- **Fallback:** If the AI call fails, rule-based results are used directly with a default 0.6 confidence score.

### 2. Summary & Timeline Generation (`generateAnalysisSummary` function)
- Claude receives aggregate statistics (IP distributions, status codes, top URLs) and anomaly data.
- It generates: an executive summary, a chronological timeline of security-relevant events, an overall threat level assessment, and key findings for SOC analysts.
- **Fallback:** If the AI call fails, a basic statistical summary is generated locally.

**No AI is used in log parsing** — the parser in [`backend/src/logs/parser.ts`](backend/src/logs/parser.ts) is entirely rule-based (regex).

## Features

- **Authentication:** Register/login with JWT tokens, session persistence
- **File Upload:** Drag-and-drop or click-to-browse, supports .log/.txt/.csv up to 50MB
- **Log Parsing:** Rule-based parser for Nginx/Apache combined log format
- **AI Analysis:** Claude-powered threat detection, timeline generation, and SOC-focused summary
- **Anomaly Detection (Bonus):** Highlighted anomalous entries with confidence scores and explanations
- **Dashboard:** Upload history with threat levels, entry counts, anomaly counts
- **Analysis View:** Three tabs — Overview (summary, timeline, charts), Log Entries (paginated table), Anomalies (detailed cards)

## Getting Started

### Prerequisites
- Docker & Docker Compose
- An Anthropic API key (get one at https://console.anthropic.com)

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and enter the project
cd "tenext.ai assesment"

# 2. Set your Anthropic API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-xxxxx

# 3. Start everything
docker compose up --build

# 4. Seed the demo user (in another terminal)
docker compose exec backend npx tsx src/seed.ts

# 5. Open http://localhost:3000
# Login: analyst@logsentry.com / password123
```

### Option 2: Manual Setup (No Docker)

**Prerequisites:** Node.js 20+, PostgreSQL running locally

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY and DATABASE_URL

# 2. Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
# Backend runs on http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### Testing the Application

1. Open http://localhost:3000
2. Login with `analyst@logsentry.com` / `password123` (or register a new account)
3. Upload the included sample file: `sample-logs/sample-access.log`
4. Wait for processing (the dashboard auto-refreshes)
5. Click the completed upload to view the full analysis

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/logs/upload` | Yes | Upload a log file |
| GET | `/api/logs/uploads` | Yes | List user's uploads |
| GET | `/api/logs/uploads/:id` | Yes | Get upload + analysis |
| GET | `/api/logs/uploads/:id/entries` | Yes | Paginated log entries |

## Project Structure

```
├── docker-compose.yml          # One-command deployment
├── .env.example                # Environment variables template
├── backend/
│   ├── prisma/schema.prisma    # Database schema
│   ├── src/
│   │   ├── index.ts            # Express server entry
│   │   ├── db.ts               # Prisma client
│   │   ├── seed.ts             # Demo user seeder
│   │   ├── auth/routes.ts      # Auth endpoints
│   │   ├── logs/
│   │   │   ├── routes.ts       # Upload & analysis endpoints
│   │   │   ├── parser.ts       # Rule-based log parser
│   │   │   └── analyzer.ts     # AI-powered analysis (Claude)
│   │   └── middleware/auth.ts  # JWT middleware
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/page.tsx      # Login/register page
│   │   │   ├── dashboard/page.tsx  # Upload & history
│   │   │   └── analysis/[id]/page.tsx  # Full analysis view
│   │   ├── components/
│   │   │   ├── FileUpload.tsx      # Drag-and-drop upload
│   │   │   ├── Timeline.tsx        # Event timeline
│   │   │   ├── LogTable.tsx        # Paginated log table
│   │   │   ├── AnomalyPanel.tsx    # Anomaly detail cards
│   │   │   └── StatusChart.tsx     # HTTP status breakdown
│   │   └── lib/
│   │       ├── api.ts              # API client
│   │       └── auth.ts             # Auth helpers
│   └── Dockerfile
└── sample-logs/
    └── sample-access.log       # Test file with attack patterns
```
