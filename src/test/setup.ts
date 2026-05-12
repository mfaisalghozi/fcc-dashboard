import { vi } from 'vitest'

// Provide a writable localStorage mock for all tests.
// jsdom 29 + Node 25 may not expose a fully functional window.localStorage.
const store: Record<string, string> = {}

const localStorageMock: Storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value) },
  removeItem: (key) => { delete store[key] },
  clear: () => { for (const k of Object.keys(store)) delete store[k] },
  get length() { return Object.keys(store).length },
  key: (i) => Object.keys(store)[i] ?? null
}

vi.stubGlobal('localStorage', localStorageMock)
