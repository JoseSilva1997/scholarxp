# Backend Structure

## Purpose
- This backend is a NestJS API located at `apps/api` in the monorepo.
- Feature modules follow the standard Nest pattern: controller + service + DTOs, grouped by domain.

## Top-Level Layout
- `apps/api/src` contains application code.
- `apps/api/test` contains end-to-end tests and test setup.
- `apps/api/prisma` contains the Prisma schema and migrations.
- `apps/api/dist` is build output (generated).

## Source Organization (`apps/api/src`)
- `app.module.ts` wires up core modules.
- Each feature lives in its own folder (e.g., `users`, `module-unit`, `question-*`).
- Shared Prisma access is under `apps/api/src/prisma`.
- Test helpers live under `apps/api/src/testing` and `apps/api/src/test`.

## Tests
- Unit tests are co-located with source files as `*.spec.ts`.
- E2E tests live in `apps/api/test` (e.g., `app.e2e-spec.ts`).
- Common test setup is in `apps/api/test/setup-env.ts` and `apps/api/test/setup-transactions.ts`.

## Related Commands
```bash
pnpm --filter api start:dev
pnpm --filter api test
pnpm --filter api test:e2e
```

## Notes
- Config loads from `.env` or `.env.test` in `apps/api` depending on `NODE_ENV`.
- Prisma migrations are managed under `apps/api/prisma/migrations`.
