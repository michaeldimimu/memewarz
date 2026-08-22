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
