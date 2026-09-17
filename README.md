# Wedding Website (Next.js)

A modern wedding invitation website where every guest can see the **real venue on an
interactive map** and **reserve a seat that nobody else can take**.

Next.js (App Router) serves both the frontend and the backend: React Server Components render
the invitation, Route Handlers expose the seat API, and private Vercel Blob storage stores the
reservations. The original single-file design lives in `../index.html` and is kept as the
visual reference.

## What the site does

| Section | Feature |
| --- | --- |
| Hero | Couple names, date/time/venue summary, live "seats secured" counters, share invitation |
| Details | Wedding details plus the **real venue map** (Leaflet + OpenStreetMap/CARTO tiles, custom gold pin, popup with "Get directions") |
| Secure a Seat | Category → table → seat picker; occupied seats are crossed out live; one atomic database write per reservation, so two guests on two phones can never take the same chair |
| Direction | Written directions, "Get directions" / "Open Google Maps" / "Share direction" buttons and a real scannable QR code |
| Gift | Bank details, copy-to-clipboard account number and a gift QR code |
| `/invite/<code>` | Personal invitation page for each guest (name, category, table, seat, invite code, QR) |
| `/admin` | Private list of all reservations, CSV export and "release seat" |

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run build   # production build
npm run start   # run the production build
npx eslint .    # lint (Next.js 16 removed `next lint`)
```

## Edit your wedding details

Everything guests see comes from **one file**: [`lib/wedding-config.ts`](lib/wedding-config.ts).

1. `brideName`, `groomName`, `weddingDate`, `weddingTime`, `dressCode`.
2. `venue` — name, address, landmark/road/junction (used for the written directions) and
   **`coordinates`**, which is the exact pin shown on the real map.
3. Set `venue.coordinatesArePlaceholder` to `false` once the coordinates are real (while it is
   `true` the map shows a red reminder chip so the site is never deployed with a wrong pin).
4. `gift` — bank name, account name, account number.

**Getting the coordinates:** open Google Maps, right-click the exact venue, click the
coordinates that appear (`6.428100, 3.421900` → lat `6.428100`, lng `3.421900`).

Optional: drop the couple's photo into `public/couple.jpg` and the hero uses it automatically
(via `next/image`). Without it, a gold gradient backdrop is used instead.

## Seating plan

Categories, tables and seat counts live in [`lib/seating.ts`](lib/seating.ts) — ported 1:1 from
the original `index.html`. Editing the numbers there immediately changes the dropdowns, the seat
grid and the server-side validation.

## Backend API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/availability` | Live seat map (categories → tables → occupied seats) |
| `POST` | `/api/reservations` | Reserve a seat. `201` on success, `409` when the seat was just taken, `400` invalid, `429` rate limited |
| `GET` | `/api/reservations` | Admin: every reservation (requires `ADMIN_KEY`) |
| `GET` | `/api/reservations?format=csv` | Admin: CSV export |
| `DELETE` | `/api/reservations?id=<id>` | Admin: release a seat |

## Data storage

In production, reservations are stored in **private Vercel Blob** as one JSON file per
reservation, for example `reservations/Table%201/3.json`. Production requires Blob
credentials and does not write reservations to the hosting filesystem.

During `npm run dev`, when Blob credentials are absent, the storage adapter saves
reservations under `data/blob-local/` instead. These gitignored files persist across
local restarts, are separate from production data, and do not import the legacy SQLite
database automatically. Local create-only writes publish a complete file atomically,
so simultaneous requests cannot overwrite an occupied seat. To use Vercel data locally,
set `BLOB_READ_WRITE_TOKEN` in `.env.local` and restart the development server.

The seat identity is the blob path
itself (`reservations/<table>/<seat>.json`), so two guests can never hold the same chair:
the second `PUT` gets a precondition failure and the guest sees a `409` with a freshly
painted seat map.

Every blob is created with `access: "private"`, so the storage is not publicly reachable.
Reads that must reflect a just-written blob use `useCache: false` (no stale cache). The app
does not use `/tmp` for persistent guest data.

Existing numeric reservation IDs are preserved. New IDs are random safe integers rather
than sequential counters; the seat blobs are the source of truth for ID lookups and
releases. Legacy counter and ID-map blobs are ignored. Reservations are listed newest
first by creation time, not by ID. Random ID collisions are checked against stored
reservations, but this is not a transactional global uniqueness guarantee.

Run the isolated storage regression tests with
`node --test scripts/reservations.test.cjs scripts/storage.test.cjs`.
These tests use in-memory storage and temporary local files; they do not access live guest data.

The storage layer lives in [`lib/reservations.ts`](lib/reservations.ts). All other parts of
the app — API routes, pages, components — talk only to that file, so the backend is a single
replaceable module.

To deploy on Vercel, enable **Blob** in the project (Vercel provisions a `BLOB_READ_WRITE_TOKEN`
automatically and injects it into serverless functions). No `WEDDING_DB_PATH` is needed anymore.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
RESEND_API_KEY=          # optional: send invitation emails automatically
EMAIL_FROM="Weddings <invites@yourdomain.com>"
ADMIN_KEY=               # protects /admin and the admin API
```

Without `RESEND_API_KEY` nothing breaks: the guest sees the confirmation on screen and can use
the "Open prepared email" (mailto) button or copy the personal invite link.

## Project structure

```
app/
  layout.tsx                metadata, fonts, global CSS
  page.tsx                  home page (server component, live seat data)
  not-found.tsx             friendly 404
  invite/[code]/page.tsx    personal invitation page
  admin/                    private reservations view
  api/                      seat availability + reservation endpoints
  components/               nav, hero, details + map, seat picker, direction, gift, QR
  globals.css               Tailwind v4 theme tokens (cream/gold palette) + components
lib/
  wedding-config.ts         all editable wedding details (including map coordinates)
  seating.ts                categories, tables, seat counts
  reservations.ts           availability, atomic reserve, invite codes, CSV (Vercel Blob backend)
  validation.ts             server-side input validation
  rate-limit.ts             simple in-memory rate limiting
  email.ts                  Resend delivery (optional)
  invite-message.ts         invitation subject/body/mailto (shared by server and browser)
```

## Verified behaviour

- `npm run build` — clean production build, TypeScript passes.
- `npx eslint .` — clean.
- `POST /api/reservations` for an occupied seat returns `409` and fresh availability.
- `/api/reservations` without the admin key returns `401`.
- `/invite/<unknown-code>` renders the friendly "invitation not found" page.
