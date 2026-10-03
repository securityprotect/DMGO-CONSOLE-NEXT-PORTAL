/*
 * DMGO Console — auth helpers.
 *
 * Login posts credentials to /api/admin/auth/login. The backend sets the
 * HttpOnly session cookie; we only cache the non-sensitive profile (name/email)
 * in localStorage for display. Logout revokes the session server-side and
 * clears the cookie. requireSession() guards authenticated pages.
 */
(function () {
  'use strict';

  var API = window.DMGO_API;
  var PROFILE_KEY = 'dmgo_console_profile';
  var LOGIN_PATH = 'login.html';

  function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p || {})); } catch (e) {} }
  function getProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; } }
  function clearProfile() { try { localStorage.removeItem(PROFILE_KEY); } catch (e) {} }

  function isPreview() {
    try {
      if (new URLSearchParams(window.location.search).get('preview') === '1') return true;
    } catch (e) {}
    return !!(window.DMGO_CONFIG && window.DMGO_CONFIG.PREVIEW_MODE);
  }

  function login(email, password, mfaCode) {
    return API.post('/admin/auth/login', { email: email, password: password, mfaCode: mfaCode || '' })
      .then(function (res) {
        if (res && res.user) saveProfile({ name: res.user.name, email: res.user.email });
        return res;
      });
  }

  function logout() {
    return API.post('/admin/auth/logout', {}, { skipRenewal: true })
      .catch(function () {})
      .then(function () {
        clearProfile();
        window.location.href = LOGIN_PATH + '?logout=1';
      });
  }

  // Returns the session object, or redirects to login. In preview mode returns a
  // mock session so the UI can be built without a live backend.
  function requireSession() {
    if (isPreview()) {
      var p = getProfile() || { name: 'Preview Admin', email: 'preview@dmgo.in' };
      return Promise.resolve({ preview: true, authenticated: true, user: p, capabilities: [] });
    }
    return API.get('/admin/session', { skipRenewal: true }).then(function (s) {
      if (s && s.authenticated) { saveProfile(s.user); return s; }
      throw new Error('not authenticated');
    }).catch(function (e) {
      if (!isPreview()) window.location.href = LOGIN_PATH;
      throw e;
    });
  }

  window.DMGO_AUTH = {
    login: login,
    logout: logout,
    requireSession: requireSession,
    getProfile: getProfile,
    saveProfile: saveProfile,
    clearProfile: clearProfile,
    isPreview: isPreview,
  };
})();
