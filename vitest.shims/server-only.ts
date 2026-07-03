// Vitest shim for `server-only`. In a real Next.js environment, importing
// `server-only` from a client component throws. Tests run in a node
// environment where we don't care, so the import is a no-op.
export {};