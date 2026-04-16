<!-- Root repository overview for academic review and local reproducibility of the ScholarXP system. -->
# ScholarXP

## Project Title and Description
ScholarXP is a full-stack study companion developed as a final-year computer science project. The system is designed to support regular academic revision through two main learning modes: structured module practice and automatically prepared daily revision sessions. Around these study flows, the project introduces lightweight gamification through daily quests, streak tracking, unlockable cosmetic rewards, and progress feedback.

From an academic perspective, the project explores how a software system can encourage consistent study behaviour without rewarding cramming. Account progression is intentionally capped on a daily basis: users gain account XP through daily quests rather than through unlimited repeated activity. This design ties progression to regular return behaviour and directs attention toward the daily practice set, which acts as the system's primary revision routine.

The daily practice set is also intended as a sequence learning mechanism. Rather than presenting revision as isolated one-off tasks, the application guides learners through recurring ordered practice over time so that repetition and spacing can contribute to stronger retention.

## Objectives
The project was designed around the following objectives:

1. To build a usable study platform that supports revision at the level of modules, units, and question groups.
2. To provide a daily practice workflow that helps learners revisit material regularly rather than only revising immediately before assessment.
3. To investigate whether daily-capped progression can incentivise consistent engagement more effectively than unrestricted XP accumulation.
4. To examine whether sequence-based daily practice can support stronger retention by encouraging repeated structured review over time.
5. To investigate whether light gamification can improve engagement without turning revision into a grind-based experience.

## Tech Stack
### Languages
- TypeScript across the frontend, backend, and shared packages
- SQL through Prisma-managed PostgreSQL schemas

### Frontend
- React 19
- Vite
- React Router
- TanStack React Query
- Motion
- Vitest
- Testing Library
- MSW for mocked network interactions in tests

### Backend
- NestJS
- Prisma ORM
- PostgreSQL
- Passport for session-based authentication and Google OAuth
- `express-session` with `connect-pg-simple` for persisted sessions
- Swagger for non-production API documentation
- Jest and Supertest for backend testing

### Shared Packages
- `packages/api-contracts` for shared request and response interfaces
- `packages/permissions` for role and capability evaluation
- `packages/progression` for canonical XP and level calculations
- `packages/constants` for shared runtime constants
- `packages/question-type-dtos` for question editor and delivery DTOs

### External Services
- Google OAuth
- SMTP-compatible email provider
- Google Cloud Storage / Firebase Storage for user-generated assets
- Sentry support on the frontend through Vite environment variables

## Architecture Overview
ScholarXP is implemented as a pnpm monorepo with three main layers: a React frontend, a NestJS backend, and a set of shared domain packages.

- The frontend in `apps/frontend` is a single-page application. It manages routing, authenticated user flows, module navigation, practice pages, quests, rewards, and profile views. Data fetching is centralized through a shared API client that applies credentials, CSRF handling, and consistent error parsing.
- The backend in `apps/backend` exposes REST endpoints and groups logic into domain modules such as authentication, daily practice, practice room, quests, rewards, profile, roster, and database entity services. Controllers remain thin while business rules are concentrated in services.
- Shared packages in `packages/*` provide the compile-time contract between client and server. API interfaces are imported by both sides, progression rules are reused across layers, and permission checks derive from a common source of truth.

Within this structure, daily quests, daily practice generation, and shared progression rules work together to enforce the product's core behavioural model: learners should return each day, complete the daily practice set, and earn capped account progress through that routine rather than through unrestricted repetition.

At runtime, the interaction flow is as follows:

1. The React client sends authenticated requests to the NestJS API using session cookies.
2. The backend applies session authentication, authorization guards, and CSRF validation before executing domain services.
3. Domain services read and write application state through Prisma, which is the only intended data-access layer.
4. Shared packages ensure that capabilities, DTO shapes, and progression calculations remain consistent across the stack.
5. Optional integrations such as Google OAuth, SMTP mail delivery, and cloud storage extend the core platform for login, email verification, and file handling.

This architecture supports separation of concerns. Learning workflows, permissions, and progression rules can evolve independently, while shared packages reduce duplication between the frontend and backend.

## Setup and Installation
### Prerequisites
- Node.js with pnpm available
- PostgreSQL running locally
- Google OAuth credentials for local sign-in
- Firebase / Google Cloud Storage service credentials if avatar or asset upload flows are exercised

### 1. Clone the repository
```bash
git clone <repository-url>
cd scholar_xp
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Configure backend environment variables
The backend loads environment files from `apps/backend/.env.<environment>`. For local development, review and update `apps/backend/.env.development`.

The following variables are required by the current backend bootstrap:

```env
NODE_ENV=development
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>?schema=public
SESSION_SECRET=<long-random-string>
CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/oauth/google/callback
MAILER_EMAIL=<from-address>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password>
MAILER_ALLOW_LOG_FALLBACK=true
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-service-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=gs://<bucket-name>
```

Notes:

- `MAILER_ALLOW_LOG_FALLBACK=true` is useful during development if email delivery should be logged rather than sent.
- Google OAuth and Firebase-related values are read during application startup, so placeholder omissions can prevent the backend from booting.

### 4. Configure frontend environment variables
Create a Vite environment file such as `apps/frontend/.env.local` with at least the API base URL:

```env
VITE_API_URL=http://localhost:3000
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=local
```

### 5. Apply database migrations
```bash
pnpm --filter backend migrate:dev
```

### 6. Run the backend
```bash
pnpm --filter backend start:dev
```

The API runs on `http://localhost:3000`.

### 7. Run the frontend
In a second terminal:

```bash
pnpm --filter frontend dev
```

The frontend runs on `http://localhost:5173`.

## Project Structure
```text
scholar_xp/
├── AGENTS.md                         # Repository-level engineering and documentation instructions
├── package.json                      # Workspace root scripts for build, lint, and test
├── pnpm-workspace.yaml               # Declares the monorepo workspaces
├── apps/
│   ├── agents/                       # Internal writing and engineering guidance files
│   ├── backend/
│   │   ├── package.json              # NestJS scripts, Prisma commands, and Jest configuration
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Database schema managed through Prisma
│   │   ├── src/
│   │   │   ├── app.module.ts         # Root backend module that composes domain modules
│   │   │   ├── main.ts               # Backend bootstrap, middleware, sessions, CSRF, and Swagger
│   │   │   ├── auth/                 # Session auth, Google OAuth, and authorization guards
│   │   │   ├── daily-practice/       # Daily revision generation, selection, and review-state logic
│   │   │   ├── practice-room/        # Question attempt flows and session orchestration
│   │   │   ├── quests/               # Quest generation, progress tracking, and streak logic
│   │   │   ├── rewards/              # Cosmetic reward retrieval and equip flows
│   │   │   ├── roster/               # Module and learner analytics for staff-facing views
│   │   │   ├── profile/              # Profile queries and student-facing projection logic
│   │   │   ├── db-entities/          # Data-facing services grouped by entity or relation
│   │   │   ├── prisma/               # Prisma module and service wiring
│   │   │   ├── mailer/               # Email delivery abstraction
│   │   │   ├── storage/              # Google Cloud Storage integration
│   │   │   └── test/                 # Test-only backend utilities and diagnostics routes
│   │   └── test/                     # End-to-end tests and shared e2e setup
│   └── frontend/
│       ├── package.json              # Vite, Vitest, and frontend scripts
│       └── src/
│           ├── App.tsx               # Route composition and authenticated shell wiring
│           ├── main.tsx              # React bootstrap and provider initialization
│           ├── api/                  # Frontend API client and domain-specific request modules
│           ├── components/           # Reusable UI components
│           ├── context/              # Global state providers such as auth and theme
│           ├── hooks/                # Page-state and query hooks
│           ├── layouts/              # Shared authenticated layouts
│           ├── routes/               # Route-level pages for landing, auth, modules, practice, etc.
│           ├── rewards/              # Cosmetic catalog and reward-related frontend logic
│           ├── permissions/          # Frontend permission helpers aligned with shared rules
│           └── test/                 # MSW server, handlers, and frontend test utilities
└── packages/
    ├── api-contracts/                # Shared API interfaces used by frontend and backend
    ├── constants/                    # Shared constants consumed across workspaces
    ├── permissions/                  # Centralized role/capability evaluation logic
    ├── progression/                  # Shared XP, level, and cosmetic progression rules
    └── question-type-dtos/           # Shared DTOs for supported question formats
```

## Usage
Once both applications are running locally, the typical interaction flow is:

1. Open the frontend at `http://localhost:5173`.
2. Register a local account or authenticate through Google OAuth.
3. Complete email verification if that flow is enabled in the configured environment.
4. Enter the authenticated area under `/main` to access modules, daily practice, quests, rewards, and profile pages.
5. Create or join modules, open a module unit, and launch a practice room session to answer questions.
6. Use the daily practice view to work through the generated daily set, which is intended to be completed as a recurring sequence rather than as a one-off revision burst.
7. Complete daily quests to earn account XP and reinforce the intended habit of returning regularly instead of cramming large volumes in a single sitting.
8. Review streaks, unlocked cosmetics, and other progress indicators as supporting feedback for ongoing use.

For backend inspection during development, Swagger documentation is exposed in non-production mode at:

```text
http://localhost:3000/docs
```

Useful local commands are:

```bash
pnpm build
pnpm lint
pnpm test
pnpm --filter backend start:dev
pnpm --filter frontend dev
```

## Testing
The project includes both backend and frontend automated tests.

### Run all tests
```bash
pnpm test
```

### Backend tests
```bash
pnpm --filter backend test
pnpm --filter backend test:cov
pnpm --filter backend test:e2e
```

Backend coverage includes:

- unit tests for public service methods and controllers
- authorization and exception-handling tests
- daily practice generation and scheduling logic
- practice room session and attempt flows
- quest generation, progress, and streak behaviour
- data-layer services and supporting utilities
- end-to-end tests for bootstrap, daily practice, quests, and practice-room XP scenarios

### Frontend tests
```bash
pnpm --filter frontend test
pnpm --filter frontend test:coverage
```

Frontend coverage includes:

- route-level rendering and navigation behaviour
- component behaviour for modules, practice, profile, rewards, and header UX
- page-state hooks and React Query hooks
- API client behaviour and error parsing
- network-dependent flows using MSW-based request mocking

## Academic Notes
Several design decisions are relevant for academic evaluation.

- The monorepo structure was chosen to reduce divergence between the frontend and backend. Shared contracts and shared progression logic make this easier to reason about and test.
- The backend follows a domain-module structure so that educational logic, progression logic, and infrastructure logic are separated. This supports maintainability and makes unit testing more focused.
- Session-based authentication with CSRF protection was used rather than a token-only approach because the project is primarily a web application with a browser-based client.
- Gamification is intentionally lightweight. XP, quests, streaks, and cosmetics are present to reinforce engagement, but the system’s main interaction remains question-based study activity.
- Account progression is deliberately capped by day. Users gain account XP through daily quests rather than through unlimited repetition, because the design goal is to reward regular re-engagement instead of short-term cramming.
- The daily practice set is intended to function as a sequence learning mechanism. The design assumption is that structured repeated exposure over time can support retention more effectively than irregular high-volume study sessions.
- The system currently depends on several external services for a full local run, notably PostgreSQL, Google OAuth, SMTP, and cloud storage. This improves realism but increases setup complexity.
- The repository demonstrates software design and implementation, but it does not by itself constitute an empirical evaluation of learning outcomes. User studies, analytics-based evaluation, or comparative trials would be appropriate future work.
- Further future work could include stronger analytics dashboards, richer adaptive scheduling and sequence-learning strategies, broader question-type support, deployment automation, and a formal user evaluation with students or instructors.
