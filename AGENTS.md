# Repository Guidelines

## Project Goal (ScholarXP)
ScholarXP is a study companion that helps students practice course content through short, repeatable sessions (daily practice/revision) with light gamification (XP/quests). The goal is to encourage consistent engagement and mastery without “grind” incentives.

## Architecture Notes (high level)
- Monorepo managed with `pnpm-workspace.yaml`. Workspaces live in `apps/*` and `packages/*`.
- Backend is a NestJS API in `apps/backend`.
- Frontend is a React + Vite app in `apps/frontend`.
- Use a **domain-module** layout in NestJS: keep controllers thin, put business rules in services, and keep recommendation/selection logic (daily sets, quests, XP rules) isolated in dedicated services so it can be unit-tested easily.
- Data access via Prisma only (no raw SQL unless unavoidable). Treat Prisma models as persistence, not your domain API—use DTOs/entities where it keeps boundaries clean.
- Permissions: use the shared matrix in `packages/permissions` as the single source of truth. Backend must enforce with the shared evaluator and return capabilities to the frontend; frontend should gate UI using server-provided capabilities or the shared evaluator as fallback.
- Authorization: protect backend routes with `SessionAuthGuard` + `AuthorizationGuard` and declare intent with `@Authorize(...)`. Keep capability checks in the shared permissions matrix, keep policy evaluation in `AuthorizationService`, and keep controllers/services responsible for business validation and domain workflows.

## API Contracts & Shared Types
- Use the **Shared Contract** pattern to sync Frontend and Backend.
- Define request/response interfaces in `packages/api-contracts` (organized by domain, e.g., `src/questions`).
- **Backend**: NestJS DTOs must strictly `implements` the shared interface to ensure compile-time synchronization.
- **Frontend**: API client and page components must import these interfaces for payloads and derive local state from them (using `Omit` or `&` for UI-only fields).
- Avoid redefining types in page components; if a type represents data from the API, it should originate from `packages/api-contracts` or `packages/*-dtos`.

## Rules
- Load the frontend-engineer agent at `apps/agents/frontend-engineer.md` when making changes to the frontend.
- Load the backend-engineer agent at `apps/agents/backend-engineer.md` when making changes to the backend.
- New files must open with a single-line comment (max ~120 chars) stating the file's responsibility in the domain context, e.g.:`// Encapsulates XP award logic; called by QuestService after activity completion`
- Comments must explain **why** a decision was made — the constraint, tradeoff, or intent — not restate what the code does. Write in plain, direct English as if briefing a teammate.
- Break tasks into a numbered plan before writing code; confirm the plan covers edge cases first.
- Error-handling: throw NestJS `HttpException`s with user-safe messages; let the global filter log and normalize. Never expose stack traces or internal error details in responses.
- Do not use deprecated packages. Verify package status before introducing any new dependency.
- All public service methods require a unit test. Do not leave unresolved `TODO`s in committed code.
- Frontend state management and hook structure are governed by `apps/agents/frontend-engineer.md`.

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

## Comment Style
- Write comments as if explaining to a teammate who knows the tech but not this repo's decisions.
- Focus on **why** — the reasoning, constraint, or tradeoff — not a restatement of what the code does.
- Use plain, direct English. Avoid filler words ("basically", "simply", "just") and do not chain unrelated clauses.
- Bad: `// iterate users array and call service to update each user entity`
- Good: `// Process each user individually — bulk update isn't used here because XP recalculation must fire per-user`

## Testing Guidelines
- Jest is configured in `apps/backend/package.json` with `ts-jest`.
- Run unit tests: `pnpm --filter backend test`.
- Run e2e tests: `pnpm --filter backend test:e2e`.
- Coverage: `pnpm --filter backend test:cov`.
- Prisma service unit tests should use `createPrismaMock()` from `apps/backend/src/test/test-helpers.ts` (jest-mock-extended deep mocks). When using `mockResolvedValue`, return objects must include all required Prisma model fields (e.g., `createdAt`, `updatedAt`, or non-nullable fields) so TypeScript type checks pass. Prefer mocking Prisma methods directly (e.g., `prisma.user.findUnique.mockResolvedValue(...)`) and inject the mock with `useValue` in `Test.createTestingModule()`.

## Agents
- Agent prompts live under `apps/agents`.
- Use `apps/agents/backend-engineer.md` whenever coding in `apps/backend`.
- Use `apps/agents/frontend-engineer.md` whenever coding in `apps/frontend`.
- Use `apps/agents/unit-test-writter.md` for NestJS unit tests.
- Use `apps/agents/docs-writer.md` for scoped Markdown docs.


## Configuration & Secrets
- Runtime config expects `.env` in `apps/backend`.