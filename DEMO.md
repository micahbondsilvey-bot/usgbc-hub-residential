# Running the demo

The whole stack (PostgreSQL + Redis + NestJS backend + Angular frontend) runs in Docker, so the
only thing you need to install is **Docker Desktop**. Node.js is *not* required on your machine,
and running in containers sidesteps the OneDrive `node_modules` problem.

## 1. Install Docker Desktop (one-time)

- Download: https://www.docker.com/products/docker-desktop/
- Install, launch it, and wait until it says "Engine running."

## 2. Start everything

Open a terminal in this folder (the one containing `docker-compose.demo.yml`) and run:

```
docker compose -f docker-compose.demo.yml up --build
```

First run takes a few minutes (it installs dependencies inside the containers). When it's ready
you'll see the backend log `Backend listening on http://localhost:3000` and the Angular dev
server compiling.

## 3. Open the app

- Frontend: http://localhost:4200
- API docs (Swagger): http://localhost:3000/api-docs

### Demo accounts

| Email | Password | Role |
|---|---|---|
| `admin@residential.test` | `Admin123!` | Global Admin |
| `team@residential.test` | `Team123!` | Project Team (demo project) |
| `rater@residential.test` | `Rater123!` | Green Rater (demo project) |
| `reviewer@residential.test` | `Reviewer123!` | Reviewer (demo project) |

### A suggested click-through

1. Log in as `admin@residential.test`. You land on the **Dashboard** (admin pipeline).
2. Open **Demo scorecard** — the seeded LEED v4.1 SF scorecard sits in the Silver band.
3. Open **Demo workbook** — field entries, the computed density fields, a submittal, and the
   three-column notes are pre-seeded.
4. Go to **Projects → Register** to run a registration end-to-end (fee quote, agreement, invoice,
   `RES-` number).
5. As `rater@` submit the demo project for review; as `reviewer@` award-all-verified, confirm, and
   return; as `team@` accept certification. Watch the notification bell update.

## 4. Stop it

```
docker compose -f docker-compose.demo.yml down
```

Add `-v` to also wipe the database volume and re-seed fresh on the next start.

## Important note on first build

This code was reconstructed from the design documents and has not yet been compiled end-to-end. The
first `docker compose ... up --build` is effectively the first real compile of ~200 files, so it may
surface TypeScript errors in the backend (`gbci-demo-backend`) or frontend (`gbci-demo-frontend`)
logs before the servers start.

If that happens, copy the error output from the terminal and share it back — the fixes are quick and
localized, and I'll work through them so the demo comes up cleanly. To capture logs for a specific
service:

```
docker compose -f docker-compose.demo.yml logs backend
docker compose -f docker-compose.demo.yml logs frontend
```

## Troubleshooting

- **Port already in use (3000 / 4200 / 5433 / 6379):** stop whatever is using the port, or edit the
  host-side port mappings in `docker-compose.demo.yml`.
- **Backend can't reach the database:** the compose file waits for Postgres health before starting
  the backend; if it still fails, run `docker compose -f docker-compose.demo.yml down -v` and start
  again.
- **Redis warnings:** harmless — the rate-limiter is fail-open and the app runs fine without Redis.
- **Frontend compiles but API calls fail:** confirm the backend container is healthy and reachable
  at http://localhost:3000/health.
