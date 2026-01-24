# Repository Guidelines

## Project Goal (ScholarXP)
ScholarXP is an LMS-launched study companion that helps students practice course content through short, repeatable sessions (daily practice/revision) with light gamification (XP/quests). The goal is to encourage consistent engagement and mastery without “grind” incentives.

## Architecture Notes (high level)
- Monorepo managed with `pnpm-workspace.yaml`. Workspaces live in `apps/*` and `packages/*`.
- Primary service is the NestJS API in `apps/api`.
- LMS-launched via LTI 1.3
- Use a **domain-module** layout in NestJS: keep controllers thin, put business rules in services, and keep recommendation/selection logic (daily sets, quests, XP rules) isolated in dedicated services so it can be unit-tested easily.
- Data access via Prisma only (no raw SQL unless unavoidable). Treat Prisma models as persistence, not your domain API—use DTOs/entities where it keeps boundaries clean.

## Project Structure & Module Organization
- Source: `apps/api/src` (feature modules like `users`, `module-unit`, `question-*`).
- Tests: unit tests co-located in `apps/api/src` as `*.spec.ts`; e2e tests in `apps/api/test`.
- Database: Prisma schema and migrations in `apps/api/prisma`.
- Build output: `apps/api/dist` (generated).

## Build, Test, and Development Commands
- Install deps: `pnpm install` (from repo root).
- Workspace commands (all packages with scripts): `pnpm build`, `pnpm lint`, `pnpm test`.
- API dev server: `pnpm --filter api start:dev` (watch mode).
- API build/start: `pnpm --filter api build`, `pnpm --filter api start`.
- Formatting: `pnpm --filter api format` (Prettier on `src` and `test`).
- Database migrations: `pnpm --filter api migrate:dev`, `pnpm --filter api migrate:test`.

## Coding Style & Naming Conventions
- TypeScript with NestJS patterns (modules, controllers, services, DTOs).
- ESLint + Prettier enforced via `apps/api/eslint.config.mjs`.
- Prefer Prettier defaults for formatting; use `format` or `lint` before committing.
- Test files: unit `*.spec.ts`, e2e `*.e2e-spec.ts`.

## Testing Guidelines
- Jest is configured in `apps/api/package.json` with `ts-jest`.
- Run unit tests: `pnpm --filter api test`.
- Run e2e tests: `pnpm --filter api test:e2e`.
- Coverage: `pnpm --filter api test:cov`.
- Prisma service unit tests should use `createPrismaMock()` from `apps/api/src/testing/test-helpers.ts` (jest-mock-extended deep mocks). When using `mockResolvedValue`, return objects must include all required Prisma model fields (e.g., `createdAt`, `updatedAt`, or non-nullable fields) so TypeScript type checks pass. Prefer mocking Prisma methods directly (e.g., `prisma.user.findUnique.mockResolvedValue(...)`) and inject the mock with `useValue` in `Test.createTestingModule()`.

## Commit & Pull Request Guidelines
- Commit messages follow short, sentence-case, past-tense summaries (e.g., "Added QuestionUnit service" or "Updated prisma schema").
- PRs should include a brief summary, tests run, and any migration notes.
- Link related issues/tickets when applicable; call out breaking API or schema changes.

## Agent-Specific Instructions
- Task-specific agent prompts live under `apps/api/agents`.
- Current backend agent: `apps/api/agents/unit-test-writter.md` for NestJS unit tests.
- Documentation agent: `apps/api/agents/docs-writer.md` for scoped Markdown docs.
- Add future frontend agents under `apps/frontend/agents` (once the React app exists) or mirror the backend layout.

## Configuration & Secrets
- Runtime config expects `.env` (and `.env.test` for tests) in `apps/api`.
- At minimum, set `DATABASE_URL`. Tests use `SKIP_PRISMA_TX` to control transactional behavior.
