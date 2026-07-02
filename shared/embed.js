// Injects the real SalesCloser FAB loader exactly like a customer snippet would.
// The loader resolves its base URL from the script src and falls back to
// querySelector('#scwa') when document.currentScript is null (injected tags),
// so the id attribute below is required.
(function () {
    var cfg = window.SC_TEST_CONFIG;
    if (!cfg || !cfg.agentUuid || cfg.agentUuid.indexOf('PASTE') === 0) {
        console.warn('[sc-test-lab] Set agentUuid in config.js first.');
        return;
    }
    var script = document.createElement('script');
    script.id = 'scwa';
    // Cache-bust the loader: it is rebuilt whenever the dashboard checkout
    // switches branches, and a dynamically injected <script> is served from the
    // browser cache even across a hard reload — so without this the page can run
    // a stale loader (e.g. one that predates Simple Scroll's section capture).
    script.src = cfg.dashboardUrl + '/js/scwa-widget.js?v=' + Date.now();
    script.setAttribute('data-agent-uuid', cfg.agentUuid);
    if (cfg.autoOpen) script.setAttribute('data-open', 'true');
    document.body.appendChild(script);
})();
