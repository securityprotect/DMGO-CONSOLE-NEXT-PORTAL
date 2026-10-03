# DMGO Console (deskapp-based admin portal)

This folder (`F:\production\deskapp`) is the **new DMGO admin console**, built on the
deskapp Bootstrap template. It talks to the existing DMGO backend
(`F:\production\DMGO-CENTRAL-BACKEND-main`) — the same backend the current
`DMGO-ADMIN-V2-main` console uses. The running console is NOT touched; this is a
fresh build you can evaluate and later swap in.

## How the connection works (same as the existing console)

- The backend exposes every console API under **`/api/admin/*`**.
- Auth is a **backend-issued HttpOnly session cookie** (`AUTH_COOKIE_DOMAIN=.dmgo.in`).
  JavaScript never sees the token.
- The browser calls the API with `credentials: 'include'` (see `assets/js/api.js`,
  a 1:1 mirror of `DMGO-ADMIN-V2-main/src/lib/api/client.ts`).
- **In production** the console is served at `console.dmgo.in` (a `.dmgo.in`
  subdomain) and nginx proxies `/api` to the backend. Same origin + shared cookie
  domain = no CORS, no hacks. This is exactly how the live console runs today.

## Files you'll work in

| File | Purpose |
|------|---------|
| `assets/js/config.js` | `API_BASE` (default `/api`, same-origin) + `PREVIEW_MODE` |
| `assets/js/api.js`    | Fetch client: cookie auth, 401→renew→login, typed helpers |
| `assets/js/auth.js`   | `login()`, `logout()`, `requireSession()` (page guard) |
| `login.html`          | Sign-in page (calls `/api/admin/auth/login`) |
| `console.html`        | Authenticated shell (sidebar + header + live session card) |
| `server.js`           | Local dev server (static + `/api` proxy), zero deps |
| `CONSOLE-SETUP.md`    | This file |

## Run it locally (UI building)

```bash
cd F:\production\deskapp
npm run console:serve          # serves http://localhost:4040
```

- Open `http://localhost:4040/login.html` (defaults to `/login.html`).
- For UI work **without a live session**, append `?preview=1`:
  `http://localhost:4040/console.html?preview=1` — shows the shell with a mock
  admin and skips the auth redirect.
- `server.js` also proxies `/api` → `BACKEND_URL` (default `http://localhost:4030`),
  so if you run a local backend you can test real calls:
  `BACKEND_URL=http://localhost:4030 PORT=4040 node server.js`.

> ⚠️ A plain `localhost` origin **cannot receive the `.dmgo.in` auth cookie**, so a
> real login only works when the console is served from a `.dmgo.in` host (i.e. on
> the VPS). Use `?preview=1` locally; test real auth on the server.

## Add a new console page

1. Copy `console.html` → `users.html` (keep the sidebar/header markup).
2. Give the sidebar link `href="users.html"`.
3. In the page script: `DMGO_AUTH.requireSession().then(s => { ... })` to guard,
   then `DMGO_API.get('/api/admin/users')` to fetch, and render into the
   `.main-container`.

The backend already has endpoints for users, plans, billing, tickets, automations,
instagram, whatsapp, diagnostics, settings, etc. (see
`DMGO-CENTRAL-BACKEND-main/src/app/api/admin/`).

## Deploy to production (replace the running console)

On the VPS, serve these static files at `console.dmgo.in` and proxy `/api` to the
backend. Example nginx server block:

```nginx
server {
    listen 443 ssl;
    server_name console.dmgo.in;

    root /path/to/deskapp;          # this folder
    index login.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4030;   # backend web replica
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /login.html;
    }
}
```

Because the page and `/api` share the `console.dmgo.in` origin, the `.dmgo.in`
auth cookie is valid and CORS is unnecessary. `console.dmgo.in` is already in the
backend `CORS_ORIGINS` allowlist as a fallback.

## Config reference

| Env / config | Default | Meaning |
|--------------|---------|---------|
| `API_BASE` (`config.js`) | `/api` | API origin. `/api` = same-origin (prod). Set absolute (e.g. `http://localhost:4030`) only for cross-origin local dev. |
| `PREVIEW_MODE` (`config.js`) | `false` | Skip auth + show mock admin (same as `?preview=1`). |
| `PORT` (`server.js`) | `4040` | Local dev server port. |
| `BACKEND_URL` (`server.js`) | `http://localhost:4030` | Where `/api` is proxied in local dev. |
