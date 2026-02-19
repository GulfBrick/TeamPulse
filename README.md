# TeamPulse — Employee Clock-In & Performance Tracking

Full-stack employee management system with clock in/out, activity tracking, task management, KPIs, and daily standups.

## Architecture

```
┌─────────────────────────────────────────┐
│  React Frontend (Vite)                  │
│  ├── Login Page (JWT auth)              │
│  ├── Admin View (full dashboard)        │
│  └── Employee View (self-service)       │
├─────────────────────────────────────────┤
│  Go Backend (Echo + GORM)               │
│  ├── JWT Auth Middleware                 │
│  ├── Role-based Access (admin/employee) │
│  ├── REST API                           │
│  └── Activity Ping Receiver             │
├─────────────────────────────────────────┤
│  PostgreSQL 16                          │
└─────────────────────────────────────────┘
```

## Features

### Admin View (You)
- **Dashboard** — Team overview: who's clocked in, hours today, tasks done, activity levels
- **Team Management** — Add/deactivate employees with email+password accounts
- **Time Entries** — Full log of all clock in/out with durations
- **Activity Tracking** — See % active vs idle per employee (based on mouse/keyboard pings every 60s)
- **Tasks** — Create, assign, prioritise tasks; see time logged per task
- **KPIs** — Set targets per employee, track progress with visual gauges
- **Standups** — Review daily standup submissions by date

### Employee View (Your Team)
- **Clock In/Out** — One-click with live elapsed timer
- **Activity Tracking** — Runs automatically in background when clocked in; detects idle after 2 min
- **Task Timers** — Start/stop timer on specific tasks to log time
- **Standups** — Submit daily standup (yesterday/today/blockers)
- **My KPIs** — View assigned performance metrics

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — change JWT_SECRET and ADMIN_PASSWORD at minimum

# 2. Build frontend into backend/static
cd frontend
npm install
npm run build
cd ..

# 3. Launch
docker compose up -d

# 4. Access
# App:   http://localhost:8080
# Login: admin@teampulse.local / admin123 (or your .env values)
```

## Development Setup

### Prerequisites
- Go 1.22+
- Node.js 18+
- PostgreSQL 16 (or Docker for DB only)

### Backend
```bash
cd backend

# Start just the database
docker compose up db -d

# Run backend
export DB_HOST=localhost DB_PORT=5432 DB_USER=teampulse DB_PASSWORD=teampulse_dev DB_NAME=teampulse
go run ./cmd/main.go
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000, proxies /api to :8080
```

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Get current user |

### Clock
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/clock/in` | Bearer | Clock in |
| POST | `/api/clock/out` | Bearer | Clock out |
| GET | `/api/clock/status` | Bearer | Current clock status |
| GET | `/api/clock/entries?date=YYYY-MM-DD` | Bearer | Time entries (admin: all, employee: own) |

### Activity
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/activity/ping` | Bearer | Record activity ping `{is_active, idle_seconds}` |
| GET | `/api/activity/stats?date=YYYY-MM-DD` | Admin | Activity % per employee |

### Tasks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks?status=pending` | Bearer | List tasks |
| POST | `/api/tasks` | Bearer | Create task |
| PUT | `/api/tasks/:id` | Bearer | Update task |
| DELETE | `/api/tasks/:id` | Bearer | Delete task |
| POST | `/api/tasks/:id/timer/start` | Bearer | Start task timer |
| POST | `/api/tasks/timer/stop` | Bearer | Stop active timer |

### KPIs, Standups, Employees
Similar CRUD patterns — see handler code for full details.

### Admin-Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Aggregated team stats |
| POST | `/api/employees` | Create employee account |
| GET | `/api/employees` | List all employees |
| DELETE | `/api/employees/:id` | Deactivate employee |

## How Activity Tracking Works

1. Employee logs in and clocks in
2. Frontend starts a background interval (every 60 seconds)
3. Detects if mouse/keyboard/click/scroll happened in the last 2 minutes
4. Sends `POST /api/activity/ping` with `{is_active: true/false, idle_seconds: N}`
5. Admin dashboard shows `active_pings / total_pings` as activity percentage
6. Pings stop when employee clocks out or closes the browser

## Production Notes

- **Change `JWT_SECRET`** — Use a 32+ char random string
- **Change `ADMIN_PASSWORD`** — Use a strong password
- **HTTPS** — Put behind Nginx/Caddy with TLS
- **Backups** — Set up PostgreSQL backup schedule
- **Monitoring** — Add `/health` endpoint to uptime monitor
