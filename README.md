# Ledger

Ledger is a dark-first, responsive weight tracker: set a goal, log a weigh-in, read the trend, and recognize consistent progress.

## Repository

- `backend/` — .NET 9 clean-architecture API, SQL Server migrations, SignalR, background reminders, and xUnit tests.
- `frontend/` — Angular 21 authenticated app, shared `api`/`components`/`domain` libraries, prerendered marketing app, Jest, and Playwright.
- `design-system/` — Aurora tokens and reference components used by both applications.
- `docs/` — product specifications, detailed designs, and static visual references.

## Run with Docker

Copy `.env.example` to `.env`, replace the SQL and JWT secrets (and supply durable VAPID keys for stable push subscriptions), start Docker Desktop, then run:

```powershell
docker compose up --build
```

The app is served at `http://localhost:8080`, marketing at `http://localhost:8081`, API documentation at `http://localhost:8082/swagger` in Development, and captured email at `http://localhost:8025`.

SQL migrations run automatically only in the Docker/development profile. Production deployments should apply `dotnet tool run dotnet-ef database update` as an explicit release step before starting the new API.

## Local checks

```powershell
dotnet test backend/Ledger.slnx
Set-Location frontend
npm ci
npm run build
npm test
npx playwright install chromium
npm run e2e
```

Production must set SQL and Redis connections, a random JWT key, durable VAPID keys, SMTP credentials, allowed origins, HTTPS termination, and an OTLP endpoint. Avatar storage is abstracted behind `IAvatarStore`; Docker uses a persistent filesystem volume.

The Terms and Privacy pages are product-specific drafts and require legal review before a production launch.
