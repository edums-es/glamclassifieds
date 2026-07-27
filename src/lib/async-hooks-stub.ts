// Stub for Node.js async_hooks in browser — prevents TanStack Start client
// from crashing with "AsyncLocalStorage is not a constructor".
export class AsyncLocalStorage {
  constructor() {}
  getStore() { return undefined }
  run(_store: unknown, callback: () => unknown) { return callback() }
  enterWith() {}
  disable() {}
  exit() {}
}
