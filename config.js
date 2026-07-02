// Test-lab configuration — edit these two values and reload.
window.SC_TEST_CONFIG = {
    // Where your dashboard is running (serves the loader + widget iframe).
    // For HYB-24 (Simple Scroll) this MUST be a dashboard on the HYB-24 branch —
    // the loader needs the scroll code. The main salescloser-dashboard checkout
    // is now on HYB-24, so point this at however you run it (default below);
    // change it if yours differs.
    dashboardUrl: 'https://localhost',

    // The agent to embed. Must be a hybrid or live-chat agent with
    // "Page Awareness" enabled in its Test Widget > Edit Appearance bar
    // (Simple Scroll rides Page Awareness — there is no separate toggle).
    // Dev DB candidate: agent #264 "amedina" (hybrid).
    agentUuid: '0e4d4497-2019-41b8-8337-5bfbe533c998',

    // Open the chat panel automatically on page load.
    autoOpen: true,
};
