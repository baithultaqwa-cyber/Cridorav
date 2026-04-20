# Cridora v2

> Digital Precious Metals Marketplace — Dubai-based, Globally Accessible

## Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 19 + Vite + Tailwind CSS v4 + Framer Motion |
| Backend  | Django 6 + Django REST Framework + JWT        |
| Database | SQLite (local default) or PostgreSQL (production) |

## Project structure

```
Cridora v2/
├── frontend/          # React app (see frontend/.env.example)
├── backend/
│   ├── cridora/       # Settings, URLs, spot price API
│   ├── users/         # Auth, catalog, orders, KYC, sell-back
│   ├── .env.example   # Copy to .env for secrets & Postgres
│   └── requirements.txt
└── metals/            # Legacy app (not installed; kept for reference only)
```

## Configuration

**Backend:** Copy `backend/.env.example` to `backend/.env` and set at least `DJANGO_SECRET_KEY` for production (`DJANGO_DEBUG=false`). For PostgreSQL, set `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (omit `POSTGRES_*` to use SQLite).

**Frontend:** Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_ORIGIN` to your API origin (e.g. `http://127.0.0.1:8000`).

## Deployment (GitHub + Railway)

See **[DEPLOY.md](./DEPLOY.md)** for pushing to GitHub and hosting the API + frontend on [Railway](https://railway.app).

---

## Getting started

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
# → http://127.0.0.1:8000
```

## Main API routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| — | `/api/auth/` | Auth, marketplace, orders, dashboards (see `users/urls.py`) |
| GET | `/api/spot-prices/` | Global spot metals (AED/g) for tickers |
| — | `/admin/` | Django admin (models registered under `users`) |

## Design tokens

| Token       | Value     | Usage                  |
|-------------|-----------|------------------------|
| Gold        | `#C9A84C` | Primary accent         |
| Gold Light  | `#E8C96A` | Hover states           |
| Silver      | `#A8A9AD` | Secondary accent       |
| Copper      | `#B87333` | Tertiary / platinum    |
| Background  | `#080808` | Page background        |
| Surface     | `#0F0F0F` | Card backgrounds       |
