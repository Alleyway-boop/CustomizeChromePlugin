/**
 * Vitest global setup file
 * Configures global test environment and mocks
 */

import { vi, beforeEach } from 'vitest'

// Mock Chrome API globally
import './mocks/chrome'

// Mock webextension-polyfill browser API
import './mocks/browser'

// Mock performance.now for deterministic tests
if (!globalThis.performance) {
  globalThis.performance = {} as Performance
}

vi.spyOn(performance, 'now').mockImplementation(() => Date.now())

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

export {}
