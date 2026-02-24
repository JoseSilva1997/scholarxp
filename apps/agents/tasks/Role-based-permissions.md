# Role-based-permissions.md — How ScholarXP enforces roles across backend and frontend

## Purpose
Central source of truth for role-based access and rendering so both backend guards and frontend UI gating stay consistent.

## Roles (global)
- `pending`: only auth + email verification + role picker; no data.
- `student`: enrolled modules only; read-only; own progress/quests.
- `teacher`: modules they created/teach; full edit for their modules; manage roster/invites; view enrolled students’ progress in those modules.
- `institution_admin`: everything within their institution; can create modules for their institution; manage instructors/students inside that institution.
- `admin`: superuser across all institutions; full CRUD.

## Backend contract
- Session: `SessionAuthGuard` loads `AuthUser` from session; `AuthorizationGuard` enforces route policy metadata from `@Authorize(...)`.
- Policy: `AuthorizationGuard` resolves route context (for example module id from route params or related entities) and delegates evaluation to `AuthorizationService`.
- Permissions: use the shared matrix in `packages/permissions` (`@scholarxp/permissions`) for capability checks. Compute and return `capabilities` in auth responses; never rely on frontend-only maps for enforcement.
- Scope model:
  - `global`: capability check only.
  - `module`: capability + module-scoped access checks (creator/membership/institution match based on role).
  - `self`: capability + target user id must match authenticated user id.
- Endpoints:
  - `GET /auth/me`: returns `AuthUser` (with `globalRole`) for UI gating.
  - `GET /module`: returns modules already scoped to caller role (admin=all; institution_admin=institution; teacher=created/assigned; student=enrolled).
  - Module-scoped endpoints use `@Authorize({ scope: 'module' })`; 401 → re-auth; 403 → not allowed; 404 → missing.
- Error hygiene: never leak raw errors; return specific 401/403/404 messages, generic for 500.

## Frontend contract
- On app boot call `/auth/me`; block pending users with role picker until role set.
- Use `capabilities` returned from `/auth/me` to gate UI; fall back to the shared evaluator (`@scholarxp/permissions`) if capabilities are absent to avoid drift.
- Fetch modules via `/module` with `credentials: 'include'`; render list as returned (already scoped).
- For module detail, handle 401 (sign-in), 403 (no permission), 404 (missing).
- Show create/roster/invite buttons only for teacher/institution_admin/admin; students stay read-only. UI hides buttons but backend still guards.
- Map errors to friendly copy; log details to Sentry logger; never show raw backend messages.

## When to load this file
- Backend: when adding/editing guards, controller routes, or module/roster/invite logic.
- Frontend: when gating UI/actions by role, fetching modules, or handling auth/permission errors.
