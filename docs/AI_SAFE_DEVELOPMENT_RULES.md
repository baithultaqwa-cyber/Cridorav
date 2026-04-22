# AI / Cursor rules — keep working code safe (Cridora v2)

This document defines how assistants should change this repo so **known-good code stays stable**, new work is **isolated**, and production (Railway) stays predictable. Pair it with [RAILWAY_MIGRATIONS.md](./RAILWAY_MIGRATIONS.md) for deploy and database workflow.

---

## 1. Default stance

1. **Do not edit code that already works** unless the user explicitly asks to change that area, or a bug is proven there with a minimal repro.
2. **Smallest possible diff**: one concern per change set. No drive-by formatting, renames, or “cleanup” outside the requested scope.
3. **Additive over invasive**: prefer new modules, new functions, or thin wrappers over rewriting existing flows.
4. If requirements are unclear, **stop and ask** instead of guessing and refactoring broadly.

---

## 2. Isolation — features as separate blocks

Goal: if something breaks, **only the new or changed block** should be suspect, not the whole app.

### Backend (Django)

- Put **new behavior** in dedicated modules: e.g. `services/<feature>.py`, `selectors/`, `api/<feature>_views.py`, or a **new Django app** when the domain is distinct.
- **Do not** grow “god” modules (`views.py` / `models.py` thousands of lines) with unrelated logic; extract when adding substantial features.
- Expose HTTP through **thin** views: validate input, call one service function, return response. Business rules live in **testable functions**, not scattered in views.
- **Avoid** changing shared utilities (`backend/**/utils.py`, middleware, settings) for a single feature unless necessary; if you must, keep the change minimal and documented in the PR/commit message.
- **Database**: new columns/tables → **new migrations only**; never edit applied migration files. See [RAILWAY_MIGRATIONS.md](./RAILWAY_MIGRATIONS.md).

### Frontend (React / Vite)

- Prefer **feature folders**: e.g. `frontend/src/features/<feature>/` with its own components, hooks, and API helpers.
- **Do not** rewrite global layout, router, or auth shell for a page-level feature unless requested.
- API base URL and env: respect `VITE_API_ORIGIN` and existing `frontend/src/config.js` patterns; do not hardcode production URLs in source.

### Boundaries

- **Backend and frontend fail independently**: API contracts (paths, payloads, status codes) should be explicit; when changing contracts, update **only** the client code that uses that endpoint, not unrelated callers.

---

## 3. Protecting “known good” behavior

1. **Read before write**: open the surrounding file and callers before changing a function; do not change signatures unless all call sites are updated in the same change.
2. **No silent behavior changes** to existing endpoints or props without the user agreeing to a breaking change.
3. Prefer **feature flags or settings** for risky behavior (e.g. `DEBUG`, `ENABLE_*` in Django settings) only when the user wants gradual rollout; otherwise keep behavior single-path but still isolated in code structure.
4. **Preserve error handling**: do not remove try/except or validation to “simplify” unless explicitly requested.

---

## 4. Git and Railway (live deploy)

- Treat **main/production** as fragile: every push may deploy. Prefer **small commits** and clear messages.
- **Migrations**: production applies them via Docker startup or SSH per [RAILWAY_MIGRATIONS.md](./RAILWAY_MIGRATIONS.md). Do not rely on `railway run migrate` from a Windows PC against internal DB hostnames.
- After backend schema changes, ensure migration files are committed and deploy order is understood (code + migrations together).
- Env vars that affect builds: **`VITE_API_ORIGIN`** (frontend build-time), **`DJANGO_PUBLIC_BASE_URL`**, media/storage — align with the migrations doc; wrong values cause 404/401/empty UI, not necessarily Python tracebacks.

---

## 5. Verification before “done”

When the user asks for a feature or fix, the assistant should:

1. State what files **must not** have been touched for this task (sanity check).
2. Run or describe **targeted** checks: relevant Django tests, `manage.py check`, frontend lint/build for touched packages — as appropriate to the repo.
3. If the assistant cannot run commands, list **exact** commands for the user in project terms (paths: `backend/`, `frontend/`).

---

## 6. When broader refactors are allowed

Only when the user **explicitly** asks for refactor, cleanup, or upgrade:

- Still do it in **stages** (mergeable chunks).
- Keep tests or manual test notes aligned with each stage.

---

## 7. Summary checklist for every AI session

- [ ] Scope is explicit; no unrelated files in the diff.
- [ ] New logic is in a **named module/feature area**, not sprinkled everywhere.
- [ ] No edits to applied migrations; new migrations only for schema changes.
- [ ] Railway/env assumptions match [RAILWAY_MIGRATIONS.md](./RAILWAY_MIGRATIONS.md).
- [ ] API or prop changes are localized to documented callers.

---

*Project: Cridora v2 — Django in `backend/`, React in `frontend/`.*
