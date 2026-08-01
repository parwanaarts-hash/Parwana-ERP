# Textile ERP

A full-stack Textile ERP system built with React, Express, and PostgreSQL.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/textile-erp`)
- **Backend**: Express API server (`artifacts/api-server`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Package manager**: pnpm workspace

## How to run

Both services start automatically via their configured workflows:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/textile-erp: web` | `PORT=24628 BASE_PATH=/ pnpm --filter @workspace/textile-erp run dev` | 24628 |
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |

The frontend is served at `/` and the API at `/api`.

## Database

Uses Replit's built-in PostgreSQL (`DATABASE_URL` secret). To push schema changes:

```bash
pnpm --filter @workspace/db run push
```

## Required secrets

- `DATABASE_URL` — PostgreSQL connection string (provisioned via Replit)
- `SESSION_SECRET` — session signing secret

## Project structure

```
artifacts/
  textile-erp/    # React/Vite frontend
  api-server/     # Express REST API
lib/
  db/             # Drizzle ORM schema & migrations
  api-zod/        # Shared Zod schemas
  api-client-react/ # React Query API client
```

## User preferences

- Preserve the existing dark-theme register/form UI design (reference: attached PDF)
- Entry point shows only two cards: Stock Module + ERP Module
