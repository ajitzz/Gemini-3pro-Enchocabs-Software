# ENCHO • Weekly Earnings (Next.js App Router)

This app lets you register drivers (with license & optional avatar), add weekly earnings, manage entries (delete), and view a Performance page. Hidden drivers are excluded everywhere.

## 1) Prerequisites
- **Node.js** 18+
- **pnpm** (recommended) or npm/yarn
- **PostgreSQL** (local or cloud). The guide below includes Docker for local DB.

## 2) Clone & install
```bash
# in VS Code terminal
pnpm i
```

## 3) Configure environment
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/encho?schema=public"
```

Alternatively, copy `.env.example` and edit it.

## 4) (Optional) Run PostgreSQL via Docker
```bash
docker compose up -d
```
This starts Postgres on port **5432** with user `postgres` / password `postgres` and DB `encho`.

## 5) Prisma setup
```bash
pnpm prisma:generate
pnpm prisma:migrate   # creates tables; follow prompts
```

(Optional) Seed a sample driver + weekly entry:
```bash
pnpm seed
```

## 6) Run the app
```bash
pnpm dev
```
Open **http://localhost:3000/performance**

Other pages:
- **/drivers** – register & manage drivers (hide/unhide).
- **/weekly/add** – add weekly earnings (Week End is auto-computed as Sunday - Asia/Kolkata).
- **/weekly/manage** – delete weekly entries (single or multi-select).

## Notes
- File uploads are saved under `public/uploads/` and the URL is stored in DB.
- Hidden drivers are excluded from **/performance**, **/weekly/add**, and all aggregations.
- The **(driverId, weekStartDate)** combo is unique to prevent duplicates.
- Timezone semantics: Week End (Sunday) computed using Asia/Kolkata offsets.

## Tailwind/Shadcn tokens
Tokens like `bg-background` are mapped via CSS variables in `tailwind.config.ts` and `app/globals.css`.
If you add more shadcn components later, run: `npx shadcn@latest init` and generate components as needed.
