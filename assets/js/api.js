/*
 * DMGO Console — API client.
 *
 * 1:1 mirror of the ADMIN-V2 client (src/lib/api/client.ts):
 *   - prepends API_BASE
 *   - sends the backend HttpOnly session cookie (credentials: 'include')
 *   - transparent 401 handling: tries /admin/session/renew, then bounces to login
 *
 * Authentication lives entirely in the backend-issued HttpOnly cookie and is
 * NOT readable by JavaScript. Do not try to store/parse the token here.
 */
(function () {
  'use strict';

  var cfg = window.DMGO_CONFIG || {};
  var API_BASE = String(cfg.API_BASE == null ? '/api' : cfg.API_BASE).replace(/\/+$/, '');
  var LOGIN_PATH = 'login.html';

  var DEFINITIVE_AUTH_CODES = {
    missing_session: true, token_expired: true, token_invalid: true,
    legacy_token_expired: true, session_idle_expired: true,
    session_revoked: true, user_inactive: true,
  };

  function ApiError(message, status, code) {
    this.name = 'ApiError';
    this.message = message;
    this.status = status;
    this.code = code;
  }
  ApiError.prototype = Object.create(Error.prototype);

  var renewalPromise = null;
  var lastRenewalAt = 0;
  var RENEWAL_INTERVAL_MS = 5 * 60 * 1000;

  function renewSession(force) {
    if (!force && Date.now() - lastRenewalAt < RENEWAL_INTERVAL_MS) return Promise.resolve(true);
    if (renewalPromise) return renewalPromise;
    renewalPromise = (function () {
      var done = function (ok) { lastRenewalAt = Date.now(); renewalPromise = null; return ok; };
      try {
        return fetch(API_BASE + '/admin/session/renew', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }).then(function (r) { return done(r.ok); }, function () { return done(false); });
      } catch (e) { return Promise.resolve(done(false)); }
    })();
    return renewalPromise;
  }

  function api(endpoint, options) {
    options = options || {};
    var body = options.body;
    var timeoutMs = options.timeoutMs || 15000;
    var headers = options.headers || null;
    var skipRenewal = !!options.skipRenewal;
    var retried = !!options.retried;
    var rest = options.rest || {};
    var method = options.method || 'GET';

    if (!skipRenewal && endpoint.indexOf('/admin/auth/') !== 0 && endpoint !== '/admin/session/renew') {
      renewSession(false);
    }

    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

    var isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);
    var fetchHeaders = {};
    if (!isFormData) fetchHeaders['Content-Type'] = 'application/json';
    if (headers) { for (var k in headers) fetchHeaders[k] = headers[k]; }

    var fetchBody;
    if (body === undefined) fetchBody = undefined;
    else if (isFormData || typeof body === 'string') fetchBody = body;
    else fetchBody = JSON.stringify(body);

    var fetchOpts = {
      method: method,
      credentials: 'include',
      headers: fetchHeaders,
      body: fetchBody,
    };
    if (controller) fetchOpts.signal = controller.signal;
    for (var rk in rest) fetchOpts[rk] = rest[rk];

    return fetch(API_BASE + endpoint, fetchOpts).then(function (res) {
      if (timer) clearTimeout(timer);
      var ct = res.headers.get('content-type') || '';
      var isJson = ct.indexOf('application/json') !== -1;
      return res.text().then(function (text) {
        var payload = isJson && text ? JSON.parse(text) : text;
        if (!res.ok) {
          var code = isJson && payload && payload.code ? payload.code : undefined;
          if (res.status === 401 && !skipRenewal && !retried) {
            return renewSession(true).then(function (renewed) {
              if (renewed) return api(endpoint, Object.assign({}, options, { retried: true }));
              throw buildAuthError(res, payload, code);
            });
          }
          if (res.status === 401 && typeof window !== 'undefined') {
            var definitive = !code || DEFINITIVE_AUTH_CODES[code];
            if (definitive && !window.location.pathname.endsWith(LOGIN_PATH)) {
              window.location.href = LOGIN_PATH + '?expired=1';
            }
          }
          throw buildAuthError(res, payload, code);
        }
        return payload;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new ApiError('Request timed out', 408);
      throw new ApiError((e && e.message) || 'Network error', 0);
    });
  }

  function buildAuthError(res, payload, code) {
    var msg = (payload && (payload.error || payload.message)) || ('Request failed (' + res.status + ')');
    return new ApiError(msg, res.status, code);
  }

  window.DMGO_API = {
    api: api,
    get: function (e, o) { return api(e, Object.assign({}, o, { method: 'GET' })); },
    post: function (e, b, o) { return api(e, Object.assign({}, o, { method: 'POST', body: b })); },
    put: function (e, b, o) { return api(e, Object.assign({}, o, { method: 'PUT', body: b })); },
    patch: function (e, b, o) { return api(e, Object.assign({}, o, { method: 'PATCH', body: b })); },
    del: function (e, b, o) { return api(e, Object.assign({}, o, { method: 'DELETE', body: b })); },
    ApiError: ApiError,
    API_BASE: API_BASE,
  };
})();
