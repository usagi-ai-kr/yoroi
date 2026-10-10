// Run script contract tests with an injected executor; never install globally.
await import(new URL('../scripts/test_update_global.mjs', import.meta.url).href);
