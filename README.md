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

The app runs as two processes (backend API + frontend SPA) against a local PostgreSQL database. Follow every step in order — each one is required.

> **How to open a terminal:**
> - **Windows:** Press `Win + R`, type `cmd` or `powershell`, press Enter. Or search "Terminal" in the Start menu.
> - **macOS:** Press `Cmd + Space`, type "Terminal", press Enter.
> - **Linux:** Press `Ctrl + Alt + T`, or search for "Terminal" in your applications.

---

### 1. Install prerequisites

You need three tools installed before anything else. If you already have them, skip ahead and just run the verify commands to confirm.

---

#### Node.js 20+

Node.js is the JavaScript runtime that powers the backend.

1. Go to [nodejs.org](https://nodejs.org/) and download the **LTS** version (the one labelled "Recommended For Most Users").
2. Run the installer and accept all defaults.
3. Open a **new** terminal window (important — an already-open terminal won't see the new install) and verify:

```bash
node --version
```

You should see something like `v20.x.x` or higher. If you see a version below 20, download the latest LTS again.

---

#### pnpm

pnpm is the package manager this project uses instead of `npm`. Install it after Node:

```bash
npm install -g pnpm
```

Verify it worked:

```bash
pnpm --version
```

You should see a version number printed. If the command is not found, close and reopen the terminal and try again.

> Need more help? See the [pnpm installation guide](https://pnpm.io/installation).

---

#### PostgreSQL 14+

PostgreSQL is the database that stores all app data.

1. Go to [postgresql.org/download](https://www.postgresql.org/download/) and pick your operating system.
2. Download and run the installer. When asked:
   - **Leave the port as `5432`** (the default).
   - **Set a password for the `postgres` user.** Write this password down — you'll need it in step 4.
   - Leave everything else as default and click through.
3. When the install finishes, open a new terminal and verify:

```bash
psql --version
```

You should see something like `psql (PostgreSQL) 14.x` or higher.

> If `psql` is not found after install, PostgreSQL's `bin` folder may not be on your PATH. See the [troubleshooting section](#troubleshooting) below.

> New to PostgreSQL? The [official getting started guide](https://www.postgresql.org/docs/current/tutorial-start.html) walks through the basics.

---

### 2. Clone the repository and install dependencies

In your terminal, navigate to a folder where you want to keep the project (e.g. your home folder or `Documents`), then run:

```bash
git clone https://github.com/JoseSilva1997/scholarxp.git
cd scholar_xp
pnpm install
```

> Don't have Git? Download it from [git-scm.com](https://git-scm.com/downloads) and run the installer with all defaults.

`pnpm install` downloads all packages for the backend, frontend, and shared workspaces. The first run will take a few minutes — this is normal. When it finishes you'll see a summary line like `Done in Xs`.

---

### 3. Create the database

Prisma (the ORM used by the backend) can create tables, but it cannot create the database itself. You need to create an empty database first.

Open a terminal and connect to PostgreSQL using the `postgres` superuser account. You'll be prompted for the password you set during the PostgreSQL install:

```bash
psql -U postgres
```

Your terminal prompt will change to look like this, meaning you're now inside the PostgreSQL interactive shell:

```
postgres=#
```

Create the database by typing this command exactly, including the semicolon at the end, then press Enter:

```sql
CREATE DATABASE scholar_xp;
```

You should see:

```
CREATE DATABASE
```

Then exit the shell:

```sql
\q
```

Your terminal prompt will return to normal. The empty database now exists and is ready for Prisma.

> You can use any database name you like instead of `scholar_xp` — just make sure to use that same name in step 4 when setting `DATABASE_URL`.

---

### 4. Configure backend environment variables

The backend reads its configuration from a `.env.development` file that you create locally. This file is never committed to Git — it's where you put secrets like your database password.

First, copy the example file to create your own:

- **macOS / Linux:**
  ```bash
  cp apps/backend/.env.example apps/backend/.env.development
  ```
- **Windows (Command Prompt):**
  ```cmd
  copy apps\backend\.env.example apps\backend\.env.development
  ```
- **Windows (PowerShell):**
  ```powershell
  Copy-Item apps\backend\.env.example apps\backend\.env.development
  ```

Now open `apps/backend/.env.development` in any text editor (Notepad, VS Code, etc.) and fill in the values below.

---

**`DATABASE_URL`**

This tells the backend how to connect to your PostgreSQL database. Replace `<your-password>` with the password you set during the PostgreSQL install:

```
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/scholar_xp?schema=public"
```

If you used a different database name in step 3, replace `scholar_xp` in the URL with that name.

Example with a real password: `DATABASE_URL="postgresql://postgres:mysecretpass@localhost:5432/scholar_xp?schema=public"`

---

**`SESSION_SECRET`**

A long random string used to sign session cookies. Generate one by running this in your terminal:

- **macOS / Linux:**
  ```bash
  openssl rand -hex 32
  ```
- **Windows (PowerShell):**
  ```powershell
  [System.Web.Security.Membership]::GeneratePassword(64, 0)
  ```
  Or just paste any long random string of letters and numbers — it doesn't need to be cryptographically perfect for local development.

Copy the output and set it in the file:
```
SESSION_SECRET="paste-your-generated-string-here"
```

---

**`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`**

These are needed for Google sign-in. You create them for free in Google Cloud Console.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) (sign in with any Google account).
2. If prompted, create a new project — name it anything (e.g. "ScholarXP Local").
3. Click **Create Credentials → OAuth client ID**.
4. If asked to configure the OAuth consent screen first, select **External**, fill in just the app name and your email, and save.
5. Back on the OAuth client ID screen, set the **Application type** to **Web application**.
6. Under **Authorised redirect URIs**, click **Add URI** and enter exactly:
   ```
   http://localhost:3000/auth/oauth/google/callback
   ```
7. Click **Create**. A dialog will show your **Client ID** and **Client Secret** — copy both.
8. Set them in the file:
   ```
   GOOGLE_CLIENT_ID="your-client-id-here"
   GOOGLE_CLIENT_SECRET="your-client-secret-here"
   ```

> Full walkthrough with screenshots: [Google's OAuth 2.0 setup guide](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).

---

**Everything else** (SMTP, Firebase) can be left as-is from the example file unless you specifically want to test email verification or avatar uploads.

---

### 5. Configure frontend environment

The frontend needs to know where the backend API is running. Create a new file at `apps/frontend/.env` (not `.env.example` — a brand new file named `.env`) and add this single line:

```env
VITE_API_URL=http://localhost:3000
```

> **How to create the file:**
> - In VS Code: right-click `apps/frontend/` in the file explorer → New File → name it `.env`
> - In a terminal from the project root:
>   - macOS/Linux: `echo "VITE_API_URL=http://localhost:3000" > apps/frontend/.env`
>   - Windows PowerShell: `echo "VITE_API_URL=http://localhost:3000" | Out-File -Encoding utf8 apps/frontend/.env`

---

### 6. Apply database migrations

Prisma migrations create all the tables in your database. Run:

```bash
pnpm --filter backend migrate:dev
```

You'll see Prisma print each migration file name as it applies it, ending with something like:

```
✔ Generated Prisma Client
```

If you get a connection error instead, go back and double-check that `DATABASE_URL` in `.env.development` has the right password and database name, and that PostgreSQL is running.

---

### 7. Start both servers

You need two terminal windows open at the same time — one for each server.

**Terminal 1 — start the backend:**

```bash
pnpm --filter backend start:dev
```

Wait until you see this line before moving on:

```
Nest application successfully started
```

The backend API is now running at `http://localhost:3000`. Keep this terminal open.

**Terminal 2 — open a second terminal, then start the frontend:**

```bash
pnpm --filter frontend dev
```

You'll see output ending with something like:

```
  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in your browser. The app is live.

> **Swagger API docs** (useful for exploring the API): `http://localhost:3000/docs`

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `psql: command not found` | PostgreSQL's `bin` folder isn't on your PATH. On macOS/Linux, add it to your shell profile (e.g. `export PATH="/usr/local/pgsql/bin:$PATH"` in `~/.zshrc`). On Windows, reinstall PostgreSQL and make sure "Add to PATH" is ticked. |
| `pnpm: command not found` | Re-run `npm install -g pnpm`, then close and reopen the terminal. |
| Prisma `P1003: database does not exist` | Step 3 was skipped, or the database name in `DATABASE_URL` doesn't match the one you created. |
| Google sign-in fails / redirect mismatch | The redirect URI in Google Cloud Console must be exactly `http://localhost:3000/auth/oauth/google/callback` — no trailing slash, no typo. |
| Frontend shows blank page or network error | Make sure the backend terminal is still running and you see `Nest application successfully started`. |
| `pnpm install` fails with permission errors | On macOS/Linux, do **not** use `sudo`. Fix npm permissions by following [this guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally). |

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
