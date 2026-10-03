/*
 * DMGO Console — runtime configuration.
 *
 * The console is designed to run BEHIND A REVERSE PROXY (nginx) at
 * console.dmgo.in, where "/api" is proxied to the backend. That keeps the
 * browser and the API on the same origin, so:
 *   - the HttpOnly session cookie (AUTH_COOKIE_DOMAIN=.dmgo.in) is valid, and
 *   - no CORS dance is needed.
 *
 * This is the SAME pattern the existing admin portal uses (its origin
 * console.dmgo.in is already in CORS_ORIGINS and shares the .dmgo.in cookie
 * domain).
 *
 * For LOCAL development against a *separate* backend, set API_BASE to an
 * absolute URL, e.g. 'http://localhost:4030', and add that origin to the
 * backend CORS_ORIGINS (see CONSOLE-SETUP.md). Note: a plain localhost origin
 * cannot receive the .dmgo.in auth cookie, so use ?preview=1 for local UI work
 * (see below) and test real auth on the VPS.
 */
window.DMGO_CONFIG = {
  // '' or '/api' -> same-origin (production / nginx-proxied).
  API_BASE: '/api',

  // Local UI building without a live session: set true, or append ?preview=1
  // to any URL. Shows the shell with a mock admin and skips the auth redirect.
  PREVIEW_MODE: false,
};
