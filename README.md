# LogSentry — AI-Powered Log Analysis Platform

A full-stack web application built for SOC (Security Operations Center) analysts to upload web server log files, automatically parse them, and receive AI-powered threat analysis. The platform provides anomaly detection with confidence scores, summarized event timelines, threat level assessments, and actionable security findings — all presented through a responsive, dark-themed dashboard.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [How AI Is Used](#how-ai-is-used)
- [Log Format Supported](#log-format-supported)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Sample Log File](#sample-log-file)
- [Screenshots & UI Walkthrough](#screenshots--ui-walkthrough)
- [Design Decisions & Trade-offs](#design-decisions--trade-offs)

---

## Architecture Overview

```
┌──────────────────┐       ┌───────────────────┐       ┌────────────────┐
│                  │       │                   │       │                │
│    Frontend      │◄─────►│    Backend API     │◄─────►│  PostgreSQL    │
│    (Next.js)     │ HTTP  │    (Express.js)    │Prisma │                │
│    Port 3000     │       │    Port 4000       │  ORM  │  Port 5432     │
│                  │       │                   │       │                │
└──────────────────┘       └─────────┬─────────┘       └────────────────┘
                                     │
                                     │ HTTPS (API calls)
                                     ▼
                           ┌───────────────────┐
                           │                   │
                           │   Anthropic API   │
                           │   (Claude LLM)    │
                           │                   │
                           └───────────────────┘
```

### Request Flow

1. **User** opens the frontend in a browser and authenticates via JWT
2. **Frontend** sends API requests to the Express backend (file uploads, data queries)
3. **Backend** receives the log file, saves it to disk, and creates a database record
4. **Parser** (`parser.ts`) extracts structured fields from each log line using regex — this is entirely rule-based, no AI
5. **Analyzer** (`analyzer.ts`) runs a two-phase AI pipeline:
   - Phase 1: Rule-based pre-filtering flags suspicious entries
   - Phase 2: Claude API reviews candidates, confirms/dismisses anomalies, generates summary
6. **Results** are stored in PostgreSQL and served back to the frontend
7. **Frontend** renders the analysis dashboard with interactive tabs

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 15.2 | React-based framework with App Router, SSR support |
| | React | 19.0 | UI component library |
| | TypeScript | 5.7 | Type-safe JavaScript |
| | Tailwind CSS | 3.4 | Utility-first CSS framework for responsive dark-themed UI |
| **Backend** | Express.js | 4.21 | Lightweight HTTP server and REST API framework |
| | TypeScript | 5.7 | Type-safe JavaScript |
| | Prisma | 6.4 | Type-safe ORM for PostgreSQL with migrations |
| | Multer | 1.4 | Multipart file upload handling middleware |
| | Zod | 3.24 | Runtime schema validation for API inputs |
| **Authentication** | jsonwebtoken (JWT) | 9.0 | Stateless token-based authentication |
| | bcryptjs | 2.4 | Password hashing with salt rounds |
| **AI** | Anthropic Claude API | claude-sonnet-4-20250514 | LLM for anomaly analysis, threat assessment, timeline generation |
| | @anthropic-ai/sdk | 0.39 | Official Node.js SDK for Anthropic API |
| **Database** | PostgreSQL | 16 | Relational database for users, uploads, log entries, analysis |
| **DevOps** | Docker Compose | 3.9 | Container orchestration for local deployment |

---

## Features

### Core Features

- **User Authentication**
  - Register with email, password, and name
  - Login with JWT token (24-hour expiry)
  - Protected routes — all log operations require authentication
  - Session persistence via localStorage
  - Input validation with Zod schemas

- **Log File Upload**
  - Drag-and-drop or click-to-browse file picker
  - Supports `.log`, `.txt`, and `.csv` file extensions
  - Maximum file size: 50MB
  - Files stored on server disk with unique generated filenames
  - Immediate 202 response — analysis runs asynchronously in the background
  - Dashboard auto-polls every 5 seconds for status updates

- **Log Parsing (Rule-Based)**
  - Regex-based parser for Nginx/Apache Combined Log Format
  - Also supports Common Log Format (simpler variant)
  - Extracts: timestamp, source IP, HTTP method, URL, status code, bytes sent, user agent, response time
  - Skips blank lines and comments (lines starting with `#`)
  - Each parsed entry is stored as a row in the `LogEntry` table

- **AI-Powered Analysis**
  - Anomaly detection with confidence scores (0.0–1.0)
  - Natural language executive summary for SOC teams
  - Chronological event timeline with severity levels (info/warning/critical)
  - Overall threat level assessment (low/medium/high/critical)
  - Key findings as actionable bullet points
  - Graceful fallback to rule-based results if AI API call fails

- **Dashboard & Visualization**
  - Upload history table with status, threat level, entry count, anomaly count
  - Three-tab analysis view: Overview, Log Entries, Anomalies
  - HTTP status code distribution chart (stacked bar with legend)
  - Top source IPs horizontal bar chart
  - Event timeline with color-coded severity dots
  - Paginated log entry table (50 entries per page)

### Bonus Feature: Anomaly Detection

- **Two-phase detection pipeline:**
  1. **Rule-based pre-filtering** screens all entries against deterministic heuristics
  2. **AI refinement** sends candidates to Claude for expert-level analysis

- **Rule-based heuristics include:**
  - High request volume from a single IP (>5x average or >50 requests)
  - Burst detection: >20 requests within a 1-minute window from same IP
  - Server errors (HTTP 5xx)
  - Access denied responses (HTTP 401, 403)
  - SQL injection patterns (`UNION SELECT`, `OR 1=1`, `DROP TABLE`)
  - XSS patterns (`<script>`, `javascript:`, `onerror=`)
  - Path traversal (`../`, `/etc/passwd`, `/.env`, `.git/`)
  - Command injection (`cmd=`, `exec=`, `system(`, `eval(`)
  - Common scanner targets (`wp-login`, `phpmyadmin`, `/admin`)
  - Unusual HTTP methods (anything other than GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS)
  - Large responses >10MB (potential data exfiltration)
  - Off-hours activity (midnight to 5 AM UTC)

- **AI provides for each confirmed anomaly:**
  - Human-readable explanation of why the entry is suspicious
  - Confidence score from 0.0 to 1.0
  - Context-aware reasoning (e.g., linking multiple entries to an attack chain)

- **Highlighted in the UI:**
  - Anomalous rows are highlighted red in the log table
  - Dedicated "Anomalies" tab with detailed cards per entry
  - Each card shows: line number, HTTP status, confidence score badge, explanation, raw log line, timestamp

---

## How AI Is Used

This application uses the **Anthropic Claude API** (`claude-sonnet-4-20250514` model) in two specific places. Both are in the file [`backend/src/logs/analyzer.ts`](backend/src/logs/analyzer.ts). **No AI is used anywhere else** — parsing is regex-based, statistics are computed programmatically, and the UI is a standard React application.

### 1. Anomaly Detection — `detectAnomalies()` function

**Location:** [`backend/src/logs/analyzer.ts`](backend/src/logs/analyzer.ts), lines 85–155

**What it does:**
- Takes the output of the rule-based `preFilterAnomalies()` function (candidates with pre-assigned reasons)
- Sends up to 100 candidates to Claude along with contextual statistics (total entries, unique IPs, status breakdown, top IPs)
- Claude acts as an expert SOC analyst, reviewing each candidate and deciding if it's a true positive or false positive
- For true positives, Claude provides a concise explanation and confidence score

**Prompt strategy:**
- Claude receives the full log line and the rule-based reasons for each candidate
- It also receives aggregate context (so it can judge what's "normal" for this specific log file)
- Response format is constrained to JSON for reliable parsing
- Only confirmed anomalies (where `anomaly: true`) are returned

**Why AI is needed here:**
- Rules catch patterns but produce false positives (e.g., a legitimate admin browsing `/admin` vs. a scanner probing it)
- Claude can recognize attack chains (e.g., SQL injection attempts followed by successful login followed by data export = likely breach)
- Claude provides explanations a SOC analyst can act on, not just "this matched a regex"

**Fallback behavior:**
- If the Claude API call fails (network error, rate limit, invalid key), the function catches the error
- It returns the rule-based candidates directly with a default confidence score of 0.6
- The application continues to work — just with less refined anomaly detection

### 2. Summary & Timeline Generation — `generateAnalysisSummary()` function

**Location:** [`backend/src/logs/analyzer.ts`](backend/src/logs/analyzer.ts), lines 160–230

**What it does:**
- Takes computed statistics (IP distributions, status code breakdown, top URLs, HTTP methods) and the confirmed anomalies from step 1
- Sends them to Claude with a request to produce a structured security report
- Claude generates four outputs:
  1. **Executive summary** (2–3 paragraphs) — a natural-language overview suitable for a SOC team briefing
  2. **Timeline** (5–15 events) — chronological sequence of the most security-relevant events, each with a timestamp, description, and severity level
  3. **Threat level** — overall assessment: low, medium, high, or critical
  4. **Key findings** — actionable bullet points that a SOC analyst should know and potentially act on

**Prompt strategy:**
- Claude is told to act as an expert SOC analyst producing a report
- Input includes time range, total entries, unique IPs, status breakdown, top 10 IPs, top 10 URLs, HTTP methods, anomaly count, and top 20 anomaly details
- Response format is constrained to a specific JSON schema for reliable parsing

**Why AI is needed here:**
- A human SOC analyst would spend significant time manually reviewing logs to build a mental timeline
- Claude can synthesize hundreds of data points into a coherent narrative
- The timeline and findings are contextualized (e.g., "The SQL injection attempts at 09:01 were followed by a successful login, suggesting credential compromise")

**Fallback behavior:**
- If the Claude API call fails, a basic statistical summary is generated programmatically
- The threat level is computed from anomaly count (>10 = high, >3 = medium, else low)
- Key findings include anomaly count, top IP, and server error count
- Timeline is returned empty

### What is NOT AI

| Component | Method | File |
|-----------|--------|------|
| Log parsing | Regex pattern matching | `backend/src/logs/parser.ts` |
| Statistics computation | Programmatic counting/aggregation | `backend/src/logs/parser.ts` → `computeStats()` |
| Pre-filtering anomalies | Deterministic rules and thresholds | `backend/src/logs/analyzer.ts` → `preFilterAnomalies()` |
| Authentication | JWT + bcrypt | `backend/src/auth/routes.ts` |
| Frontend UI | React components | `frontend/src/` |
| Database operations | Prisma ORM queries | All route handlers |

---

## Log Format Supported

### Nginx/Apache Combined Log Format

```
<source_ip> <ident> <user> [<timestamp>] "<method> <url> <protocol>" <status> <bytes> "<referer>" "<user_agent>"
```

**Example:**
```
192.168.1.100 - admin [15/Mar/2024:08:23:01 +0000] "GET /api/dashboard HTTP/1.1" 200 4521 "https://app.example.com/login" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Parsed fields:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `sourceIp` | string | `192.168.1.100` | Client IP address |
| `timestamp` | DateTime | `2024-03-15T08:23:01Z` | Request timestamp |
| `method` | string | `GET` | HTTP method |
| `url` | string | `/api/dashboard` | Requested URL path |
| `statusCode` | integer | `200` | HTTP response status code |
| `bytesSent` | integer | `4521` | Response body size in bytes |
| `userAgent` | string | `Mozilla/5.0...` | Client user agent string |
| `responseTime` | float | `0.045` | Optional response time (if present at end of line) |

The parser also supports the simpler **Common Log Format** (without referer and user agent fields).

---

## Database Schema

The application uses PostgreSQL with 4 tables, managed via Prisma ORM:

### User
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated unique identifier |
| `email` | String (unique) | User email for login |
| `password` | String | bcrypt-hashed password |
| `name` | String | Display name |
| `createdAt` | DateTime | Account creation timestamp |

### Upload
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated unique identifier |
| `filename` | String | Server-side filename (generated) |
| `originalName` | String | Original uploaded filename |
| `size` | Integer | File size in bytes |
| `status` | String | `pending` → `processing` → `completed` / `failed` |
| `userId` | UUID (FK) | References `User.id` |
| `createdAt` | DateTime | Upload timestamp |

### LogEntry
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated unique identifier |
| `uploadId` | UUID (FK) | References `Upload.id` (cascade delete) |
| `lineNumber` | Integer | Line number in original file |
| `timestamp` | DateTime? | Parsed timestamp (nullable if parsing fails) |
| `sourceIp` | String? | Client IP address |
| `method` | String? | HTTP method (GET, POST, etc.) |
| `url` | String? | Requested URL path |
| `statusCode` | Integer? | HTTP response status code |
| `userAgent` | String? | Client user agent |
| `bytesSent` | Integer? | Response size in bytes |
| `responseTime` | Float? | Response time if available |
| `rawLine` | String | Original raw log line |
| `isAnomaly` | Boolean | Whether this entry was flagged as anomalous |
| `anomalyReason` | String? | AI-generated explanation of the anomaly |
| `anomalyScore` | Float? | Confidence score (0.0–1.0) |

**Indexes:** `uploadId`, `sourceIp`, `timestamp` — for efficient filtering and aggregation queries.

### Analysis
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated unique identifier |
| `uploadId` | UUID (FK, unique) | One-to-one with `Upload` (cascade delete) |
| `summary` | Text | AI-generated executive summary |
| `timeline` | JSON | Array of `{time, event, severity}` objects |
| `threatLevel` | String | `low` / `medium` / `high` / `critical` |
| `totalEntries` | Integer | Number of parsed log entries |
| `anomalyCount` | Integer | Number of detected anomalies |
| `topIps` | JSON | Array of `{ip, count}` — top 10 source IPs |
| `statusBreakdown` | JSON | `{2xx, 3xx, 4xx, 5xx}` counts |
| `keyFindings` | JSON | Array of finding strings |

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Request Body | Response |
|--------|----------|------|-------------|----------|
| `POST` | `/api/auth/register` | No | `{email, password, name}` | `{token, user: {id, email, name}}` |
| `POST` | `/api/auth/login` | No | `{email, password}` | `{token, user: {id, email, name}}` |
| `GET` | `/api/auth/me` | Bearer token | — | `{user: {id, email, name, createdAt}}` |

**Validation:**
- Email must be valid format
- Password minimum 6 characters
- Name minimum 1 character
- Duplicate email returns 409

### Log Operations

| Method | Endpoint | Auth | Description | Response |
|--------|----------|------|-------------|----------|
| `POST` | `/api/logs/upload` | Bearer token | Upload log file (multipart form, field: `file`) | `{uploadId, status: "processing", message}` (202) |
| `GET` | `/api/logs/uploads` | Bearer token | List all uploads for authenticated user | `{uploads: [...]}` with analysis summary |
| `GET` | `/api/logs/uploads/:id` | Bearer token | Get full upload details with complete analysis | `{upload: {..., analysis: {...}}}` |
| `GET` | `/api/logs/uploads/:id/entries` | Bearer token | Get paginated log entries | `{entries: [...], pagination: {page, limit, total, totalPages}}` |

**Query parameters for `/entries`:**
- `page` (default: 1) — page number
- `limit` (default: 50, max: 200) — entries per page
- `anomalies=true` — filter to only anomalous entries

### Health Check

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| `GET` | `/api/health` | No | `{status: "ok", timestamp}` |

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** (for the database, or full deployment)
- **Node.js 20+** (if running backend/frontend outside Docker)
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

### Option 1: Docker Compose (Recommended)

This starts PostgreSQL, the backend, and the frontend in containers.

```bash
# 1. Clone the repository
git clone https://github.com/saisreech23/test.git
cd test

# 2. Configure environment
cp .env.example .env
# Edit .env and set your Anthropic API key:
#   ANTHROPIC_API_KEY=sk-ant-your-real-key-here

# 3. Start all services
docker compose up --build

# 4. Seed the demo user (in a new terminal)
docker compose exec backend npx tsx src/seed.ts

# 5. Open the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
```

### Option 2: Manual Setup (No Docker for app, Docker for DB only)

```bash
# 1. Clone the repository
git clone https://github.com/saisreech23/test.git
cd test

# 2. Configure environment
cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY=sk-ant-your-real-key-here
#   DATABASE_URL=postgresql://logsentry:logsentry_pass@localhost:5434/logsentry

# 3. Start PostgreSQL via Docker
docker compose up db -d

# 4. Set up and start the backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
# Backend starts on http://localhost:4000

# 5. Set up and start the frontend (new terminal)
cd frontend
npm install
npm run dev
# Frontend starts on http://localhost:3000
```

### Option 3: Fully Manual (No Docker at all)

Requires PostgreSQL already running locally.

```bash
# 1. Create the database
psql -U postgres -c "CREATE USER logsentry WITH PASSWORD 'logsentry_pass';"
psql -U postgres -c "CREATE DATABASE logsentry OWNER logsentry;"

# 2. Clone and configure
git clone https://github.com/saisreech23/test.git
cd test
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY and DATABASE_URL pointing to your local PostgreSQL

# 3. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Testing the Application

1. Open **http://localhost:3000** in your browser
2. Login with the demo account:
   - Email: `analyst@logsentry.com`
   - Password: `password123`
3. Upload the included sample file: `sample-logs/sample-access.log`
4. Wait for processing — the dashboard auto-refreshes every 5 seconds
5. Click the completed upload row to view the full analysis
6. Explore the three tabs: **Overview** (AI summary, timeline, charts), **Log Entries** (paginated table), **Anomalies** (detailed cards with confidence scores)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key for Claude |
| `DATABASE_URL` | Yes | (see .env.example) | PostgreSQL connection string |
| `JWT_SECRET` | No | `change-me-in-production` | Secret key for signing JWT tokens |
| `PORT` | No | `4000` | Backend server port |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded log files |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Backend URL for frontend API calls |

---

## Project Structure

```
logsentry/
├── docker-compose.yml              # Container orchestration (PostgreSQL + backend + frontend)
├── .env.example                    # Environment variables template (copy to .env)
├── .gitignore                      # Excludes node_modules, .env, uploads, .next
├── README.md                       # This file
│
├── backend/                        # Express.js REST API
│   ├── Dockerfile                  # Production container build
│   ├── package.json                # Dependencies and scripts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema (4 models: User, Upload, LogEntry, Analysis)
│   │   └── migrations/             # SQL migration files
│   │       └── 20240315000000_init/
│   │           └── migration.sql   # Initial schema creation
│   └── src/
│       ├── index.ts                # Express server entry point, CORS, route mounting
│       ├── db.ts                   # Prisma client singleton
│       ├── seed.ts                 # Seeds demo user (analyst@logsentry.com)
│       ├── middleware/
│       │   └── auth.ts             # JWT authentication middleware
│       ├── auth/
│       │   └── routes.ts           # POST /register, POST /login, GET /me
│       └── logs/
│           ├── routes.ts           # POST /upload, GET /uploads, GET /uploads/:id, GET /entries
│           ├── parser.ts           # Rule-based log parser (regex) + statistics computation
│           └── analyzer.ts         # AI-powered analysis (Claude API) — anomaly detection + summary
│
├── frontend/                       # Next.js React application
│   ├── Dockerfile                  # Production container build
│   ├── package.json                # Dependencies and scripts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── next.config.ts              # Next.js configuration (standalone output)
│   ├── tailwind.config.ts          # Tailwind CSS theme (dark mode colors)
│   ├── postcss.config.mjs          # PostCSS with Tailwind plugin
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          # Root layout (HTML shell, global CSS import)
│       │   ├── globals.css         # Tailwind base + custom component classes
│       │   ├── page.tsx            # Root page — redirects to /login or /dashboard
│       │   ├── login/
│       │   │   └── page.tsx        # Login & registration form
│       │   ├── dashboard/
│       │   │   └── page.tsx        # File upload + upload history table
│       │   └── analysis/
│       │       └── [id]/
│       │           └── page.tsx    # Full analysis view (tabs: overview, logs, anomalies)
│       ├── components/
│       │   ├── FileUpload.tsx      # Drag-and-drop file upload with validation
│       │   ├── Timeline.tsx        # Vertical event timeline with severity-colored dots
│       │   ├── LogTable.tsx        # Paginated log entry table with color-coded status/method
│       │   ├── AnomalyPanel.tsx    # Anomaly detail cards with confidence scores & explanations
│       │   └── StatusChart.tsx     # HTTP status code stacked bar chart with legend
│       └── lib/
│           ├── api.ts              # API client (fetch wrapper with JWT auth, error handling)
│           └── auth.ts             # Auth helpers (localStorage token/user management)
│
└── sample-logs/
    └── sample-access.log           # 48-entry test file with realistic attack patterns
```

---

## Sample Log File

The included [`sample-logs/sample-access.log`](sample-logs/sample-access.log) contains 48 entries simulating a realistic day of web server activity with multiple attack patterns:

| Time Range | Activity | Source IP | Type |
|------------|----------|-----------|------|
| 08:23–08:35 | Normal user browsing (dashboard, users, reports) | 192.168.1.100–102 | Legitimate |
| 08:24 | Googlebot crawling | 10.0.0.55 | Legitimate |
| 08:30 | WordPress/phpMyAdmin scanning, `.env` and `.git` probing | 45.33.32.156 | **Reconnaissance scan** |
| 09:01 | SQL injection attempts (`UNION SELECT`, `OR 1=1`) | 203.0.113.42 | **SQL injection** |
| 09:01 | Brute-force login (5 failed attempts then success) | 203.0.113.42 | **Brute force + credential compromise** |
| 09:01 | User data export (12MB response) after compromised login | 203.0.113.42 | **Data exfiltration** |
| 02:15–02:16 | Off-hours internal API probing, attempted `/exec` access | 198.51.100.23 | **Suspicious internal access** |
| 03:45 | TRACE method request | 172.16.0.200 | **Unusual HTTP method** |
| 11:30 | Repeated HTTP 500 errors | 192.168.1.104 | **Server instability** |
| 13:00 | XSS attempt (`<script>alert(1)</script>`) and path traversal | 203.0.113.42 | **XSS + path traversal** |

This sample is designed to trigger multiple anomaly detection rules and produce a **CRITICAL** threat level assessment.

---

## Screenshots & UI Walkthrough

### Login Page
- Clean dark-themed login form with email/password
- Toggle between Sign In and Register modes
- Demo credentials displayed for easy testing

### Dashboard
- File upload area with drag-and-drop support
- Analysis history table showing: filename, size, status, threat level, entry count, anomaly count, timestamp
- Click any completed row to view full analysis

### Analysis View — Overview Tab
- **AI Summary**: Multi-paragraph executive summary (marked with "Claude AI" badge)
- **Key Findings**: Bulleted actionable insights for SOC analysts
- **Event Timeline**: Vertical timeline with color-coded severity dots (blue=info, yellow=warning, red=critical)
- **Status Code Chart**: Stacked bar showing 2xx/3xx/4xx/5xx distribution with percentages
- **Top Source IPs**: Horizontal bar chart with request counts

### Analysis View — Log Entries Tab
- Paginated table with columns: line number, time, source IP, method, URL, status, bytes, anomaly badge
- Color-coded HTTP methods (green=GET, blue=POST, yellow=PUT, red=DELETE)
- Color-coded status codes (green=2xx, blue=3xx, yellow=4xx, red=5xx)
- Anomalous rows highlighted with red background
- Previous/Next pagination controls

### Analysis View — Anomalies Tab
- Summary banner showing total anomaly count
- Individual anomaly cards with:
  - Line number, HTTP status, source IP, method
  - Confidence score badge (color-coded: red >=80%, orange >=60%, yellow >=40%)
  - "Why flagged" explanation from AI
  - Raw log line in monospace code block
  - Timestamp

---

## Design Decisions & Trade-offs

| Decision | Reasoning |
|----------|-----------|
| **Express over Next.js API routes** | Separating backend allows independent scaling, file system access for uploads, and long-running AI processing without blocking the frontend |
| **Async processing with polling** | Upload returns 202 immediately; frontend polls every 5s. Simpler than WebSockets for this use case, and the user sees progress naturally |
| **Two-phase anomaly detection** | Rule-based pre-filtering reduces Claude API token usage by ~90%. Only suspicious entries are sent to AI, making it cost-efficient |
| **JSON responses from Claude** | Constraining AI output to JSON enables reliable parsing. Regex extraction of JSON from response handles edge cases where Claude adds explanation text |
| **Fallback on AI failure** | The app remains functional even without a valid API key — rule-based analysis still works, just without AI refinements |
| **PostgreSQL over SQLite** | Better concurrent access, JSON column support for analysis results, and production-ready from the start |
| **JWT over sessions** | Stateless auth simplifies the backend (no session store needed), works well with SPA architecture |
| **Tailwind CSS dark theme** | SOC analysts typically work in dark environments; dark theme reduces eye strain during extended log review sessions |
| **Prisma ORM** | Type-safe database queries that match the TypeScript backend, automatic migration management |
| **Local file storage** | Simplest approach for local development. For production, this should be swapped to S3/R2 (noted in deployment feasibility) |
