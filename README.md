# Plan A Meal: Weekly Meal Planner

> **Replace this whole file.** It is a worked example of the README your project
> will be graded from, not a file to leave as it is. Start with
> [START-HERE.md](START-HERE.md).

One sentence saying what this does and who it is for.

**Live site:** https://yourusername.github.io/your-repo-name/
**API:** https://your-api.onrender.com/healthz
**Demo video:** (link)

> **This deployment is running in demo mode.** The interface is real; the backend
> is simulated in your browser so the site works without a server. See
> [Demo mode](#demo-mode) below. Delete this quote once your API is live.

![A screenshot of the main screen](docs/assets/screenshot.png)

## What it does

- Report a sighting with a place, a description and a spookiness rating
- Browse everything reported, newest first
- Delete a report

## Built with

React and Vite on the front end, Express and PostgreSQL on the back end. The
client is on GitHub Pages, the API on (host), the database on (host).

## Demo mode

This repository can run two ways, chosen by one environment variable at **build**
time.

**Demo mode is the default.** Only the exact string `false` turns it off, so a
forgotten or mistyped variable leaves you on the simulated backend with a visible
notice rather than on a silently broken build.

| `VITE_USE_MOCK_API` | What happens |
| --- | --- |
| unset, or `true` | The client answers its own requests from `localStorage`. No server, no database, nothing shared between visitors. This is what the template ships with, so the GitHub Pages link works on day one. |
| `false` | The client calls the Express API at `VITE_API_BASE_URL`, which reads and writes real PostgreSQL. |

**Demo mode is a starting point and a fallback, not a finished project.** Your
finals submission is all three pieces deployed and talking to each other. Demo
mode is there so you can build the interface in week one before the API exists,
and so you have something to show if a free tier is asleep during your demo.

GitHub Pages serves files and cannot run Node, so the API and the database can
never live there. They go somewhere else:

| Piece | Options |
| --- | --- |
| **API** | Render, Railway, Fly.io, Koyeb, a VPS, or [self-hosted behind a tunnel](../content/extending-your-app/11-self-hosting.md) |
| **Database** | Neon, Supabase, Railway, Aiven, or your own PostgreSQL |

`content/extending-your-app/` in your course workspace walks through all of it.
Page 10 is the decision page if you do not know which to pick.

## Running it yourself

**The client only, in demo mode.** No database needed.

    cd client
    npm install
    cp .env.example .env        # VITE_USE_MOCK_API stays true
    npm run dev                 # http://localhost:5173

**The whole stack.** Needs a PostgreSQL, either local or hosted.

    # 1. the database
    docker run --name my-pg -e POSTGRES_PASSWORD=devpassword \
      -e POSTGRES_DB=haunted -p 5432:5432 -d postgres:17

    # 2. the API
    cd server
    npm install
    cp .env.example .env        # check DATABASE_URL
    npm run db:reset            # creates the tables and adds sample rows
    npm run dev                 # http://localhost:3000

    # 3. the client, in another terminal
    cd client
    npm install
    cp .env.example .env
    # set VITE_USE_MOCK_API=false
    npm run dev

Check the API on its own before you blame the client:

    curl http://localhost:3000/healthz     # is the process alive
    curl http://localhost:3000/readyz      # is the database reachable
    curl http://localhost:3000/api/sightings

## Accounts (Supabase)

With Supabase configured, visitors must log in (username or email and a
password, or Google) and each account's weekly plan, shopping list ticks and
ingredient edits are saved to Supabase. Recipes stay bundled with the client
from `server/db/recipes.js`. Without Supabase configured, the app runs as
before with no login.

One-time setup:

1. **Tables.** Supabase dashboard > SQL Editor > New query: paste all of
   `supabase/schema.sql` and Run. It creates the tables, the Row Level Security
   policies that keep each user's rows private, and the sign-up trigger.
2. **Keys.** In `client/.env` set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Project Settings > API: the project URL and the
   *publishable* key, never the secret one).
3. **Redirect URLs.** Authentication > URL Configuration: set Site URL to your
   live site, and add `http://localhost:5173/` and
   `https://<username>.github.io/<repo>/` under Redirect URLs.
4. **Google.** In Google Cloud Console > APIs & Services > Credentials, the
   OAuth client (type: Web application) needs
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised
   redirect URI. Then in Supabase > Authentication > Sign In / Providers >
   Google, turn it on and paste that client's ID and secret. The client secret
   belongs only in the Supabase dashboard, never in this repository.
5. **Deploying.** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
   repository variables (Settings > Secrets and variables > Actions >
   Variables) so the Pages build includes them.

Email sign-up sends a confirmation link by default (Authentication > Sign In /
Providers > Email > Confirm email). The login form accepts a username by looking
up its email with `email_for_username` in `schema.sql`; the trade-off is noted
there.

## Environment variables

None of these are committed. `.env.example` in each folder lists them with
placeholder values.

| Name | Where | What it is |
| --- | --- | --- |
| `DATABASE_URL` | server | PostgreSQL connection string. Contains a password |
| `CORS_ORIGINS` | server | comma-separated origins allowed to call the API |
| `NODE_ENV` | server | `production` on your host |
| `PORT` | server | **set by the host**, do not set it yourself |
| `VITE_USE_MOCK_API` | client, at build time | only `false` turns demo mode off; unset means on |
| `VITE_API_BASE_URL` | client, at build time | your API's public URL, no trailing slash |
| `VITE_SUPABASE_URL` | client, at build time | Supabase project URL; with the key below, turns on accounts |
| `VITE_SUPABASE_ANON_KEY` | client, at build time | Supabase **publishable** key, public by design (RLS protects the data) |

Every `VITE_` value is compiled into the built JavaScript and is **public**.
Never put a key, a password or a connection string in one.

## Deploying

**Client, to GitHub Pages.** Already wired up in
`.github/workflows/deploy-pages.yml`. Two one-time steps:

1. **Settings > Pages > Build and deployment > Source: GitHub Actions.** Without
   this the workflow goes green and publishes nothing.
2. Nothing else, until your API is live. Demo mode is the default, so the first
   deploy works on its own. When the API is up, add `VITE_USE_MOCK_API` = `false`
   and `VITE_API_BASE_URL` under **Settings > Secrets and variables > Actions >
   Variables**, then re-run the workflow.

The repository must be **public** for Pages to serve it on a free account.

**API and database.** Not automated here, because most hosts deploy straight from
your repository with no workflow at all. Point your host at the `server/` folder,
set the environment variables in its dashboard, and run `server/db/schema.sql`
once against the hosted database.

## Project structure

    client/          React front end, built by Vite
      src/api/       ONE interface, three implementations (demo, Express, Supabase)
      src/components/
    server/          Express API
      db/            pool, schema.sql, seed.sql, and a runner for them
    supabase/        schema.sql for accounts and saved weeks on Supabase
    compose.yml      only if you self-host
    docs/            your planning documents and weekly reports

## Architecture

Three or four sentences, or a small diagram. Which piece talks to which, and
where each one is hosted.

## What I would do next

Three honest bullets. This paragraph is worth more than it looks.

## Author

Your name, and a link. Course and section.

## Licence

MIT, see [LICENSE](LICENSE). Put your own name in it.
