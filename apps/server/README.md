# memewarz - server

Minimal Express + TypeScript server template for hackathons.

Getting started

1. Install deps:

```bash
cd apps/server
pnpm install
```

2. Run in development:

```bash
pnpm --filter ./apps/server dev
```

3. Build & run:

```bash
pnpm --filter ./apps/server build
pnpm --filter ./apps/server start
```

Structure
- `src/index.ts` - server bootstrap
- `src/app.ts` - express app and middleware
- `src/routes` - route registrations
- `src/controllers` - request handlers
- `src/middleware` - app middleware

Database (PostgreSQL + Prisma)

- Add a `DATABASE_URL` to your environment (see `.env.example`).
- Generate the Prisma client:

```bash
# From the package folder (uses installed prisma binary if available)
pnpm run prisma:generate

# If the prisma binary is not available, use pnpm dlx (downloads+runs temporarily):
pnpm run prisma:generate:dlx
```

- Run migrations (dev):

```bash
# Using installed binary
pnpm run prisma:migrate

# Or via pnpm dlx if you run into "prisma: not found":
pnpm run prisma:migrate:dlx
```

Troubleshooting
- If TypeScript complains it cannot find `@prisma/client`, run the generate step and restart your TS server.
- If `prisma` can't be found when running the script, install Prisma CLI at the workspace root:

```bash
pnpm -w add -D prisma
```

- Alternatively run with `pnpm dlx prisma ...` as shown above.

The Prisma schema is at `prisma/schema.prisma` and a `PrismaClient` wrapper is exported from `src/db.ts`.
