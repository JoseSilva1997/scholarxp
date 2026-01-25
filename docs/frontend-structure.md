# Frontend Structure (React + Vite)

## Purpose
- Explain how the frontend is organized and where to put new UI code.

## Location
- Frontend app lives in `apps/frontend`.
- Source code lives in `apps/frontend/src`.

## Entry Points
- `apps/frontend/index.html` is the HTML shell Vite uses in dev/build.
- `apps/frontend/src/main.tsx` mounts the React app onto `#root`.
- `apps/frontend/src/App.tsx` is the top-level component that wires app-wide providers and routes.

## Key Folders (inside `src/`)
- `apps/frontend/src/api`: API client helpers and per-feature request functions.
- `apps/frontend/src/types`: shared TypeScript types for API responses and UI data.
- `apps/frontend/src/components`: reusable UI pieces (forms, cards, buttons).
- `apps/frontend/src/routes`: page-level screens tied to navigation or app states.
- `apps/frontend/src/context`: app-wide state (auth session, theme, etc.).
- `apps/frontend/src/hooks`: custom hooks that encapsulate reusable logic.
- `apps/frontend/src/assets`: static assets imported by the app.

## Styling
- `apps/frontend/src/index.css` holds global styles and CSS variables.
- `apps/frontend/src/App.css` holds page-level styles for the current screens.

## Dev Commands
```bash
pnpm --filter frontend dev
pnpm --filter frontend build
pnpm --filter frontend preview
pnpm --filter frontend lint
```

## Notes
- Keep page-level layout in `routes/` and keep shared UI in `components/`.
- Put API calls in `api/` and the shared response types in `types/`.
- `App.tsx` should stay small: app shell + providers + route selection.
