/**
 * Global Type Declarations for Test Files
 * Provides TypeScript types for test globals and mocks
 */

/// <reference types="vitest/globals" />

// Extend globalThis for chrome and browser mocks
declare global {
  // eslint-disable-next-line no-var
  var chrome: typeof import('./mocks/chrome').chrome
  // eslint-disable-next-line no-var
  var browser: typeof import('./mocks/browser').browser
}

export {}
