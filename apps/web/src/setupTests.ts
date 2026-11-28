import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { db, server } from './test/server';

// The first test to open a page loads its code (and libraries like the chart) for the first
// time, which can take over a second on CI's slower machines. findBy* waits 1s by default.
configure({ asyncUtilTimeout: 3000 });

// Fail loudly if a test makes a request no handler expects.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  db.reset();
});
afterAll(() => server.close());

// jsdom lacks a few browser APIs that Radix UI (used by shadcn/ui) relies on.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
window.scrollTo = () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
// Toasts (Sonner) read the light/dark setting.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }) as MediaQueryList;
