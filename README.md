<!-- Root repository overview for academic review and local reproducibility of the ScholarXP system. -->
# ScholarXP

A full-stack study companion that merges adaptivity, gamification, and sequence learning to incentivise daily practice over mass practice.

> Final-year BSc Computer Science project (CS6P05). Not a production product — built to explore whether daily-capped progression and sequenced revision can encourage consistent study behaviour.

## Goal

Most study apps reward volume: the more you grind, the more you progress. ScholarXP inverts that. Progression is capped per day and tied to returning tomorrow, not to marathon sessions today. The daily practice set is the core revision routine — small, sequenced, and shaped by what the learner has recently struggled with or is overdue to revisit.

## Practice Loop

ScholarXP is built around a simple daily cycle:

1. **Complete a lesson** — learner works through a module unit for the first time, building initial memory traces on each question.
2. **A practice set is ready the next day** — the scheduler picks 3–6 questions from completed units, prioritising overdue reviews, then recent struggles, then occasionally the next unseen question from a started lesson. Set size matches genuine review pressure.
3. **Learner practices** — answers update each question's memory profile. First-attempt accuracy drives when the question next appears.
4. **XP and quests reinforce the habit** — lessons give a small XP drip; the bulk of progression comes from daily quests that reset every day (e.g. complete the daily set, hit a clean-answer streak). Natural daily cap: three hours on one day earns no more than fifteen minutes a day for a week.
5. **Cycle repeats** — each day's set is rebuilt from current memory state. Keep up → lighter sets. Fall behind → heavier sets. Always reflects where the learner actually is.

## Features

- Module/unit/question-group content hierarchy with role-gated authoring
- Practice room with multiple question types (shared DTOs in `packages/question-type-dtos`)
- Daily practice generator: spaced-repetition scheduling restricted to completed units
- Daily quests, streak tracking, and capped XP progression
- Cosmetic rewards unlocked through account level
- Session auth with Google OAuth, CSRF protection, role/capability matrix


## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 19, Vite, React Router, TanStack Query, Motion, Vitest, Testing Library, MSW |
| Backend | NestJS, Prisma, PostgreSQL, Passport (session + Google OAuth), `express-session` + `connect-pg-simple`, Swagger, Jest, Supertest |
| Shared | `api-contracts`, `permissions`, `progression`, `constants`, `question-type-dtos` |
| External | Google OAuth, SMTP, Google Cloud / Firebase Storage, Sentry (optional) |

Monorepo managed by pnpm workspaces. Frontend and backend share compile-time contracts through `packages/*` so DTOs, permission rules, and XP calculations stay in sync across layers.

## Setup

The project runs as two processes (backend API + frontend SPA) against a local PostgreSQL database. If you have never used Node.js, pnpm, or Prisma before, follow every step in order — each one is needed.

### 1. Install prerequisites

Install these on your machine first. Links go to the official installers.

- **Node.js 20 or newer** — JavaScript runtime. Download from [nodejs.org](https://nodejs.org/) (pick the LTS version). Verify in a terminal:
  ```bash
  node --version    # should print v20.x.x or higher
  ```
- **pnpm** — package manager used by this monorepo (replaces `npm`). After Node is installed, run:
  ```bash
  npm install -g pnpm
  pnpm --version    # should print a version number
  ```
- **PostgreSQL 14 or newer** — relational database. Download from [postgresql.org/download](https://www.postgresql.org/download/). During install, set a password for the default `postgres` user and keep the default port `5432`. Verify the server is running:
  ```bash
  psql --version
  ```

### 2. Clone and install dependencies

```bash
git clone https://github.com/JoseSilva1997/scholarxp.git
cd scholar_xp
pnpm install
```

`pnpm install` downloads every package for the backend, frontend, and shared workspaces. It may take a few minutes on the first run.

### 3. Create the database

The backend expects a PostgreSQL database to already exist — Prisma will fill it with tables in the next step, but it will not create the database itself.

Open a terminal and connect to PostgreSQL (you'll be prompted for the password you set during install):

```bash
psql -U postgres
```

Inside the `psql` prompt, create the database and exit:

```sql
CREATE DATABASE scholar_xp;
\q
```

Any name works — just remember it for the next step.

### 4. Configure backend environment variables

Copy the example file and edit it:

```bash
cp apps/backend/.env.example apps/backend/.env.development
```

Open `apps/backend/.env.development` in an editor and fill in at minimum:

- `DATABASE_URL` — point it at the database you just created. Format:
  ```
  DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/scholar_xp?schema=public"
  ```
  Replace `<your-password>` with the password set during PostgreSQL install. If you used a different database name in step 3, replace `scholar_xp` too.
- `SESSION_SECRET` — any long random string (e.g. output of `openssl rand -hex 32`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → "Create Credentials" → "OAuth client ID" → Web application. Add `http://localhost:3000/auth/oauth/google/callback` as an authorized redirect URI.

SMTP and Firebase values can be left as placeholders unless you want to exercise email verification or avatar uploads.

### 5. Configure frontend environment

Create `apps/frontend/.env` with a single line:

```env
VITE_API_URL=http://localhost:3000
```

This tells the React app where the backend API lives.

### 6. Apply database migrations

Prisma is the ORM that manages the database schema. "Applying migrations" means: read the migration files in `apps/backend/prisma/migrations/`, and run them against your database so all the tables get created. Run:

```bash
pnpm --filter backend migrate:dev
```

You should see Prisma list each migration and confirm it was applied. If you get a connection error, double-check `DATABASE_URL` in `.env.development`.

### 7. Start both servers

Open two terminals. In the first, start the backend:

```bash
pnpm --filter backend start:dev
```

Wait until you see `Nest application successfully started` — the API is now running at `http://localhost:3000`.

In the second terminal, start the frontend:

```bash
pnpm --filter frontend dev
```

Open `http://localhost:5173` in a browser. The app is now live.

Swagger API docs (dev only): `http://localhost:3000/docs`

### Troubleshooting

- **`psql: command not found`** — PostgreSQL's bin folder isn't on your PATH. On macOS/Linux add it via your shell profile; on Windows reinstall and tick "Add to PATH".
- **`pnpm: command not found`** — re-run `npm install -g pnpm` and reopen the terminal.
- **Prisma "database does not exist"** — step 3 was skipped or the database name in `DATABASE_URL` doesn't match.
- **Google sign-in fails with redirect error** — the callback URL in Google Cloud Console must match `GOOGLE_CALLBACK_URL` exactly.

## Project Structure

```text
scholar_xp/
├── apps/
│   ├── backend/                 # NestJS API
│   │   ├── prisma/              # Schema + migrations
│   │   ├── src/
│   │   │   ├── auth/            # Session auth, OAuth, authorization guards
│   │   │   ├── daily-practice/  # Daily set generation + review scheduling
│   │   │   ├── practice-room/   # Question attempt flows
│   │   │   ├── quests/          # Quest generation, progress, streaks
│   │   │   ├── rewards/         # Cosmetic unlocks
│   │   │   ├── roster/          # Staff-facing analytics
│   │   │   ├── profile/         # Learner profile projections
│   │   │   ├── db-entities/     # Prisma-backed entity services
│   │   │   ├── mailer/          # Email delivery
│   │   │   └── storage/         # GCS integration
│   │   └── test/                # End-to-end tests
│   └── frontend/                # React + Vite SPA
│       └── src/
│           ├── api/             # API client + domain modules
│           ├── routes/          # Route-level pages
│           ├── components/      # Reusable UI
│           ├── hooks/           # Page-state + React Query hooks
│           ├── context/         # Auth/theme providers
│           └── test/            # MSW handlers + test utils
└── packages/
    ├── api-contracts/           # Shared request/response interfaces
    ├── permissions/             # Role/capability evaluation
    ├── progression/             # XP + level calculations
    ├── constants/               # Shared runtime constants
    └── question-type-dtos/      # Question editor/delivery DTOs
```

## Usage

1. Open `http://localhost:5173`, register or sign in with Google.
2. Verify email if that flow is enabled.
3. Enter `/main` for modules, daily practice, quests, rewards, profile.
4. Join a module, open a unit, launch a practice session.
5. Return the next day — daily set will be waiting. Complete quests to progress the account level.

## Testing

```bash
pnpm test                          # all workspaces
pnpm --filter backend test         # unit
pnpm --filter backend test:e2e     # end-to-end
pnpm --filter backend test:cov     # coverage
pnpm --filter frontend test        # unit + MSW-mocked network
pnpm --filter frontend test:coverage
```

Backend coverage: service/controller units, authorization, daily practice scheduling, practice-room flows, quest/streak logic, e2e for bootstrap, daily practice, quests, practice-room XP.

Frontend coverage: route rendering, component behaviour, page-state hooks, React Query hooks, API client, MSW-mocked flows.

## Implementation Status

Implemented: module/unit authoring, practice room, daily practice generator, quest/streak system, capped XP progression, cosmetic rewards, session auth + Google OAuth, role/capability matrix, staff roster views.

Not implemented / future work: analytics dashboards for instructors, richer adaptive scheduling strategies, broader question-type support, deployment automation, empirical user evaluation.

## Academic Context

This repo demonstrates software design and implementation only — it does not constitute an empirical evaluation of learning outcomes. A user study or comparative trial would be appropriate next work. Full design rationale, methodology, and evaluation sit in the accompanying explanatory notes document, not in this README.

## License

Licensed under [PolyForm Noncommercial 1.0.0](LICENSE).

Permitted: personal use, classroom/educational use, academic research, evaluation. Tutors are welcome to use this in teaching.

Not permitted: any commercial use, including selling, hosting as a paid service, or incorporating into a commercial product. Contact the author for commercial licensing.
