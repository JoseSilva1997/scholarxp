# ScholarXP

A full-stack study companion that uses spaced repetition, daily quests, and capped XP progression to encourage consistent daily practice over marathon sessions.

Built as a final-year BSc Computer Science project (CS6P05). Not a production product — designed to explore whether daily-capped progression and sequenced revision can build better study habits.

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 19, Vite, React Router, TanStack Query, Motion |
| Backend | NestJS, Prisma, PostgreSQL, Passport (session + Google OAuth) |
| Shared packages | `api-contracts`, `permissions`, `progression`, `question-type-dtos` |
| External | Google OAuth, SMTP, Google Cloud Storage |

Monorepo managed by **pnpm workspaces**. Frontend and backend share compile-time contracts through `packages/*`.

---

## Installation

The app runs as two processes (backend API + frontend SPA) against a local PostgreSQL database. Follow every step in order.

### 1. Install prerequisites

**Node.js 20+** — Download the LTS version from [nodejs.org](https://nodejs.org/). Verify:
```bash
node --version   # should print v20.x.x or higher
```

**pnpm** — Install after Node:
```bash
npm install -g pnpm
pnpm --version
```
> See [pnpm.io/installation](https://pnpm.io/installation) if you run into issues.

**PostgreSQL 14+** — Download from [postgresql.org/download](https://www.postgresql.org/download/). During install:
- Keep the default port `5432`
- Set a password for the `postgres` user — you'll need it in step 4

Verify:
```bash
psql --version
```
> If `psql` is not found after install, see the [troubleshooting section](#troubleshooting).

---

### 2. Clone and install dependencies

```bash
git clone https://github.com/JoseSilva1997/scholarxp.git
cd scholar_xp
pnpm install
```

First run takes a few minutes — pnpm is downloading packages for all workspaces.

---

### 3. Create the database

Prisma manages the schema but won't create the database itself. Connect to PostgreSQL and create an empty one:

```bash
psql -U postgres
```

You'll be prompted for the password you set during install. Once inside the `psql` prompt:

```sql
CREATE DATABASE scholar_xp;
\q
```

Any name works — just use the same name in step 4 when setting `DATABASE_URL`.

---

### 4. Configure backend environment variables

Copy the example file:

```bash
# macOS / Linux
cp apps/backend/.env.example apps/backend/.env.development

# Windows (PowerShell)
Copy-Item apps\backend\.env.example apps\backend\.env.development
```

Open `apps/backend/.env.development` and fill in these values:

**`DATABASE_URL`**
```
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/scholar_xp?schema=public"
```
Replace `<your-password>` with your PostgreSQL password. If you used a different database name in step 3, replace `scholar_xp` too.

**`SESSION_SECRET`** — any long random string. Generate one with:
```bash
# macOS / Linux
openssl rand -hex 32

# Windows (PowerShell)
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

**`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** — needed for Google sign-in:
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create a project if you don't have one.
2. Click **Create Credentials → OAuth client ID → Web application**.
3. If prompted to configure the OAuth consent screen first, select **External**, fill in the app name and your email, and save.
4. Under **Authorised redirect URIs**, add `http://localhost:3000/auth/oauth/google/callback`.
5. Copy the **Client ID** and **Client Secret** into the env file.

> Full walkthrough: [Google's OAuth 2.0 setup guide](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).

SMTP and Firebase values can be left as placeholders unless you want to test email verification or avatar uploads.

---

### 5. Configure frontend environment

Create `apps/frontend/.env` with:

```env
VITE_API_URL=http://localhost:3000
```

---

### 6. Apply database migrations

```bash
pnpm --filter backend migrate:dev
```

Prisma will print each migration as it runs. If you get a connection error, double-check `DATABASE_URL` in `.env.development`.

---

### 7. Start both servers

Open two terminals. In the first, start the backend:

```bash
pnpm --filter backend start:dev
```

Wait for `Nest application successfully started` before continuing. The API runs at `http://localhost:3000`.

In the second terminal, start the frontend:

```bash
pnpm --filter frontend dev
```

Open `http://localhost:5173` in a browser. The app is live.

> Swagger API docs (dev only): `http://localhost:3000/docs`

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `psql: command not found` | PostgreSQL's `bin` folder isn't on your PATH. On macOS/Linux add it to your shell profile; on Windows reinstall and tick "Add to PATH". |
| `pnpm: command not found` | Re-run `npm install -g pnpm` and reopen the terminal. |
| Prisma `P1003: database does not exist` | Step 3 was skipped, or the database name in `DATABASE_URL` doesn't match. |
| Google sign-in fails / redirect mismatch | The redirect URI in Google Cloud Console must be exactly `http://localhost:3000/auth/oauth/google/callback`. |
| Frontend blank page or network error | Check the backend terminal is still running and shows `Nest application successfully started`. |
| `pnpm install` fails with permission errors | Don't use `sudo` on macOS/Linux. See [npm's permissions guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally). |

---

## Usage

1. Open `http://localhost:5173` and register or sign in with Google.
2. Join a module, open a unit, and complete a lesson.
3. Return the next day — a daily practice set will be ready based on what you've completed.
4. Complete daily quests to earn XP and progress your account level.
5. Unlock cosmetic rewards as your level increases.

---

## License

Licensed under [PolyForm Noncommercial 1.0.0](LICENSE).

**Permitted:** personal use, classroom/educational use, academic research, evaluation.

**Not permitted:** any commercial use, including selling, hosting as a paid service, or incorporating into a commercial product. Contact the author for commercial licensing.
