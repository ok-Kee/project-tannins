# Project Tannins

A multi-tenant wine pairing PWA for restaurant servers. Staff look up wines from a curated list and get food pairing recommendations; managers maintain the list through a protected admin interface.

## What it does

**Server view** (`/{slug}/server`) — servers search the wine list by rack number or beverage name, browse pairings with menu items, and read sommelier notes and AI-generated pairing suggestions. Designed for tablet use on the floor; no login required.

**Cuisine view** (`/{slug}/cuisine`) — a dish-first lookup: browse menu items and see which wines pair with each one.

**Admin panel** (`/{slug}/de`) — password-protected. Managers add and edit wines (with label/bottle photo uploads), set by-the-glass and bottle prices, assign rack locations, write sommelier comments, curate menu item pairings, and customize the restaurant logo and theme colors.

**Landing page** (`/{slug}`) — public entry point that links to the server and cuisine views.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Frontend | Vanilla JS PWA — no build step, tablet-first |
| Auth | HTTP Basic Auth (bcrypt) on admin routes |
| AI | Anthropic Claude API — generates food pairing copy during seeding |
| Hosting | Render (web service + 10 GB persistent disk) |

## Running locally

This is a hosted SaaS product. The instructions below are for running a local instance — useful for evaluating the codebase or development.

**Prerequisites:** Node.js 18+, an Anthropic API key (seed enrichment only).

```bash
git clone <repo>
cd project-tannins
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY and TANNINS_BAR_PASS
npm run db:init
npm start
```

The server starts at `http://localhost:3000`. Visit `http://localhost:3000/tannins-bar` to see the landing page.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `3000`) |
| `ANTHROPIC_API_KEY` | For seeding | Used by `seed:enrich` to generate pairing copy |
| `TANNINS_BAR_PASS` | Yes | Admin password for the `tannins-bar` restaurant |
| `DATA_DIR` | Production | Mount path for persistent disk (e.g. `/data`); defaults to local `./db/` |
| `DB_PATH` | Optional | Explicit path to the SQLite file — overrides `DATA_DIR` |

## Database

Schema is created by `npm run db:init` (idempotent — safe to re-run on an existing database).

| Table | Purpose |
|---|---|
| `restaurants` | One row per tenant; holds slug, Basic Auth credentials, logo path, and theme colors |
| `beverages` | Shared beverage catalog with AI-generated `general_pairing` text |
| `wine_list` | Per-restaurant wine entries — links a beverage to a restaurant with pricing, images, and sommelier notes |
| `racks` | Physical rack numbers for a restaurant |
| `menu_items` | Dishes on the restaurant's menu |
| `menu_item_pairings` | Many-to-many join between menu items and wine list entries |

## Seeding a restaurant

Two scripts handle initial data load for a new restaurant:

```bash
# 1. Import wines from an Excel spreadsheet
npm run seed:import

# 2. Call Claude to generate general_pairing text for unenriched beverages
npm run seed:enrich
```

`seed:enrich` only processes rows where `general_pairing` is null, so it is safe to re-run incrementally.

## API overview

All routes are prefixed with the restaurant slug where multi-tenant.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/beverages` | Public | Search beverages by name |
| `POST` | `/api/beverages` | — | Create a beverage |
| `GET` | `/api/:slug/restaurant` | Public | Get restaurant info |
| `PUT` | `/api/:slug/restaurant` | Admin | Update restaurant info / upload logo |
| `GET` | `/api/:slug/racks` | Public | List racks |
| `POST` | `/api/:slug/racks` | Admin | Create a rack |
| `GET` | `/api/:slug/wine-list` | Public | List all wine list entries |
| `GET` | `/api/:slug/wine-list/:id` | Public | Get a single entry |
| `POST` | `/api/:slug/wine-list` | Admin | Add an entry (multipart: label/bottle images) |
| `PUT` | `/api/:slug/wine-list/:id` | Admin | Update an entry |
| `DELETE` | `/api/:slug/wine-list/:id` | Admin | Remove an entry |
| `GET` | `/api/:slug/wine-list/:id/pairings` | Public | List menu item pairings for a wine |
| `POST` | `/api/:slug/wine-list/:id/pairings` | Admin | Add a pairing |
| `DELETE` | `/api/:slug/wine-list/:id/pairings/:pairingId` | Admin | Remove a pairing |
| `GET` | `/api/:slug/menu-items` | Public | List menu items |
| `POST` | `/api/:slug/menu-items` | Admin | Create a menu item |
| `PUT` | `/api/:slug/menu-items/:id` | Admin | Update a menu item |
| `DELETE` | `/api/:slug/menu-items/:id` | Admin | Delete a menu item (cascades pairings) |
| `GET` | `/api/:slug/menu-items/:id/pairings` | Public | List wine pairings for a dish |
| `POST` | `/api/:slug/menu-items/:id/pairings` | Admin | Add a pairing |
| `DELETE` | `/api/:slug/menu-items/:id/pairings/:pairingId` | Admin | Remove a pairing |

Admin routes use HTTP Basic Auth. Credentials are stored per-restaurant in the `restaurants` table (password bcrypt-hashed).

## Deploying to Render

The `render.yaml` in the repo root defines the service. Set `ANTHROPIC_API_KEY` and `TANNINS_BAR_PASS` as secret environment variables in the Render dashboard; everything else is pre-configured. The persistent disk mounts at `/data`, where both the SQLite database and uploaded images are stored.
