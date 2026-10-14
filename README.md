# Horserace Catalog

Online tradeshow product catalog. React 18 + TypeScript + Vite + Tailwind, backed by Supabase (auth + Postgres), hosted on GitHub Pages.

- All users must sign in (Supabase email/password auth) to browse the catalog.
- Only admins can upload catalog data (Excel/CSV) — enforced by row-level security.

## Prerequisites

1. Create a [Supabase](https://supabase.com) project.
2. In the Supabase SQL editor, run `supabase/schema.sql` (creates `products` + `profiles` tables, RLS policies, and the new-user profile trigger).
3. In the Supabase dashboard under **Authentication → Users**, create user accounts.
4. To make a user an admin, set `is_admin = true` for their row in the `profiles` table (SQL editor or Table editor).

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL (Supabase dashboard → Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Project anon/public key (same page) |

## Local development

```bash
npm install
npm run dev
```

## Deployment (GitHub Pages)

1. Push this repo to GitHub as `horserace`.
2. In repo **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. In repo **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Push to `main` — the `Deploy to GitHub Pages` workflow builds and publishes to `https://<user>.github.io/horserace/`.
