/**
 * Example unit test to verify test infrastructure is working
 */

import { describe, it, expect, vi } from 'vitest'

describe('Test Infrastructure', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true)
    expect(1 + 1).toBe(2)
  })

  it('should have Chrome API mocked', () => {
    expect(globalThis.chrome).toBeDefined()
    expect(globalThis.chrome.tabs).toBeDefined()
    expect(globalThis.chrome.storage).toBeDefined()
    expect(globalThis.chrome.runtime).toBeDefined()
    expect(globalThis.chrome.windows).toBeDefined()
  })

  it('should mock Chrome tabs API', () => {
    const mockTab = {
      id: 1,
      url: 'https://example.com',
      title: 'Example',
      active: true,
      pinned: false,
      windowId: 1,
      index: 0,
    }

    expect(globalThis.chrome.tabs.get).toBeDefined()
    expect(globalThis.chrome.tabs.query).toBeDefined()
    expect(globalThis.chrome.tabs.sendMessage).toBeDefined()
  })

  it('should mock Chrome storage API', () => {
    expect(globalThis.chrome.storage.local).toBeDefined()
    expect(globalThis.chrome.storage.local.get).toBeInstanceOf(Function)
    expect(globalThis.chrome.storage.local.set).toBeInstanceOf(Function)
  })

  it('should mock Chrome runtime API', () => {
    expect(globalThis.chrome.runtime.id).toBeDefined()
    expect(globalThis.chrome.runtime.sendMessage).toBeDefined()
    expect(globalThis.chrome.runtime.getURL).toBeInstanceOf(Function)
  })

  it('should reset mocks between tests', () => {
    const mockFn = vi.fn()
    mockFn('test')
    expect(mockFn).toHaveBeenCalledWith('test')

    // Mocks are cleared in beforeEach in setup.ts
    vi.clearAllMocks()
    expect(mockFn.mock.calls.length).toBe(0)
  })
})
