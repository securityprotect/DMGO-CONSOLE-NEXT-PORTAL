/* Shared console shell: session guard, header/sidebar profile, active-nav highlight.
   Every console-*.html loads this AFTER defining window.__pageInit. */
(function () {
	function hidePreloader() {
		var p = document.querySelector('.pre-loader');
		if (p) p.style.display = 'none';
	}
	// Safety: never let the loader stick.
	window.addEventListener('load', function () { setTimeout(hidePreloader, 1200); });
	setTimeout(hidePreloader, 3000);

	function ini(name) {
		var p = String(name || '?').trim().split(/\s+/);
		return ((p[0] || '?')[0] || '?').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
	}

	if (!window.DMGO_AUTH || !window.DMGO_API) {
		console.error('DMGO shell: API/auth libs not loaded before shell.js');
		return;
	}

	window.DMGO_AUTH.requireSession().then(function (s) {
		var u = (s && s.user) || {};
		var name = u.name || 'Admin';
		var email = u.email || '';
		var an = document.getElementById('admin-name'); if (an) an.textContent = name;
		var ae = document.getElementById('admin-email'); if (ae) ae.textContent = email;
		var spn = document.getElementById('sp-name'); if (spn) spn.textContent = name;
		var spe = document.getElementById('sp-email'); if (spe) spe.textContent = email;
		var spa = document.getElementById('sp-avatar'); if (spa) spa.textContent = ini(name);
		var nl = document.getElementById('notif-list');
		if (nl) nl.innerHTML = '<li><a href="#"><h3>' + name + '</h3><p>' + ((s && s.capabilities) || []).length + ' admin capabilities loaded.</p></a></li>';

		// Highlight the current page in the sidebar.
		var page = location.pathname.split('/').pop();
		document.querySelectorAll('[data-page]').forEach(function (li) {
			if (li.getAttribute('data-page') === page) li.classList.add('active');
		});

		var r = (typeof window.__pageInit === 'function') ? window.__pageInit(s) : null;
		Promise.resolve(r).then(hidePreloader).catch(hidePreloader);
	}).catch(function () {
		window.location.href = 'login.html';
	});

	var lb = document.getElementById('logout-btn');
	if (lb) lb.addEventListener('click', function (e) { e.preventDefault(); window.DMGO_AUTH.logout(); });
})();
