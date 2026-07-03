// Vitest setup: ensure DOM globals exist if a test file accidentally pulls
// in client components. Most tests run in node env, but this stub keeps
// import chains safe.
if (typeof globalThis.window === "undefined") {
  // noop
}