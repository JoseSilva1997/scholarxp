# Repository Guidelines

## Project Goal (ScholarXP)
ScholarXP is an LMS-launched study companion that helps students practice course content through short, repeatable sessions (daily practice/revision) with light gamification (XP/quests). The goal is to encourage consistent engagement and mastery without “grind” incentives.

## Architecture Notes (high level)
- Monorepo managed with `pnpm-workspace.yaml`. Workspaces live in `apps/*` and `packages/*`.
- Backend is a NestJS API in `apps/backend`.
- Frontend is a React + Vite app in `apps/frontend`.
- LMS-launched via LTI 1.3.
- Use a **domain-module** layout in NestJS: keep controllers thin, put business rules in services, and keep recommendation/selection logic (daily sets, quests, XP rules) isolated in dedicated services so it can be unit-tested easily.
- Data access via Prisma only (no raw SQL unless unavoidable). Treat Prisma models as persistence, not your domain API—use DTOs/entities where it keeps boundaries clean.

## Rules
- Load the frontend-engineer agent at `apps/agents/frontend-engineer.md` when making changes to the frontend.
- Load the backend-engineer agent at `apps/agents/backend-engineer.md` when making changes to the backend.
- Whenever creating a new file, add a description of what its role is at the top
- You MUST add comments. Comments must explain why it is coded that way and offer a very brief description of what is being done.
- Break tasks down into smaller chunks and formulate a plan to complete a task. 
- Write production ready code.
- Error-handling: never surface raw backend messages to users; expected/validation errors should show tailored messages, unexpected errors should be generic. Log full details to server logs or monitoring, keep UI messages sanitized.

## Project Structure & Module Organization
- Backend source: `apps/backend/src` (feature modules like `users`, `module-unit`, `question-*`).
- Backend tests: unit tests co-located in `apps/backend/src` as `*.spec.ts`; e2e tests in `apps/backend/test`.
- Backend database: Prisma schema and migrations in `apps/backend/prisma`.
- Backend build output: `apps/backend/dist` (generated).
- Frontend source: `apps/frontend/src`.
- Frontend entry: `apps/frontend/src/main.tsx`, `apps/frontend/index.html`.

## Build, Test, and Development Commands
- Install deps: `pnpm install` (from repo root).
- Workspace commands (all packages with scripts): `pnpm build`, `pnpm lint`, `pnpm test`.
- API dev server: `pnpm --filter backend start:dev` (watch mode).
- API build/start: `pnpm --filter backend build`, `pnpm --filter backend start`.
- Formatting: `pnpm --filter backend format` (Prettier on `src` and `test`).
- Database migrations: `pnpm --filter backend migrate:dev`, `pnpm --filter backend migrate:test`.
- Frontend dev server: `pnpm --filter frontend dev`.
- Frontend build/preview: `pnpm --filter frontend build`, `pnpm --filter frontend preview`.
- Frontend lint: `pnpm --filter frontend lint`.

## Coding Style & Naming Conventions
- TypeScript with NestJS patterns (modules, controllers, services, DTOs).
- ESLint + Prettier enforced via `apps/backend/eslint.config.mjs`.
- Prefer Prettier defaults for formatting; use `format` or `lint` before committing.
- Test files: unit `*.spec.ts`, e2e `*.e2e-spec.ts`.
- Frontend uses React + Vite conventions; keep components small and composable.

## Testing Guidelines
- Jest is configured in `apps/backend/package.json` with `ts-jest`.
- Run unit tests: `pnpm --filter backend test`.
- Run e2e tests: `pnpm --filter backend test:e2e`.
- Coverage: `pnpm --filter backend test:cov`.
- Prisma service unit tests should use `createPrismaMock()` from `apps/backend/src/testing/test-helpers.ts` (jest-mock-extended deep mocks). When using `mockResolvedValue`, return objects must include all required Prisma model fields (e.g., `createdAt`, `updatedAt`, or non-nullable fields) so TypeScript type checks pass. Prefer mocking Prisma methods directly (e.g., `prisma.user.findUnique.mockResolvedValue(...)`) and inject the mock with `useValue` in `Test.createTestingModule()`.

## Commit & Pull Request Guidelines
- Commit messages follow short, sentence-case, past-tense summaries (e.g., "Added QuestionUnit service" or "Updated prisma schema").
- PRs should include a brief summary, tests run, and any migration notes.
- Link related issues/tickets when applicable; call out breaking API or schema changes.

## Agents
- Agent prompts live under `apps/agents`.
- Use `apps/agents/backend-engineer.md` whenever coding in `apps/backend`.
- Use `apps/agents/frontend-engineer.md` whenever coding in `apps/frontend`.
- Use `apps/agents/unit-test-writter.md` for NestJS unit tests.
- Use `apps/agents/docs-writer.md` for scoped Markdown docs.


## Configuration & Secrets
- Runtime config expects `.env` (and `.env.test` for tests) in `apps/backend`.
- At minimum, set `DATABASE_URL`. Tests use `SKIP_PRISMA_TX` to control transactional behavior.
