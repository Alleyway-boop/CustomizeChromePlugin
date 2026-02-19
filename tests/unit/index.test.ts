/**
 * Utility Index Unit Tests
 * Tests for message type definitions and utility exports
 */

import { describe, it, expect } from 'vitest'
import type {
  Message,
  Response,
  SendResponse,
  TabStatus,
  FreezeTabStatus
} from '@/utils/index'

describe('Message Type', () => {
  it('should accept valid message with greeting', () => {
    const message: Message = { greeting: 'hello' }

    expect(message.greeting).toBe('hello')
  })

  it('should accept valid message with async flag', () => {
    const message: Message = { async: true }

    expect(message.async).toBe(true)
  })

  it('should accept valid message with getTabId flag', () => {
    const message: Message = { getTabId: true }

    expect(message.getTabId).toBe(true)
  })

  it('should accept valid message with UpDateLastUseTime flag', () => {
    const message: Message = { UpDateLastUseTime: true }

    expect(message.UpDateLastUseTime).toBe(true)
  })

  it('should accept valid message with UpdatePageInfo flag and url', () => {
    const message: Message = {
      UpdatePageInfo: true,
      url: 'https://example.com',
      title: 'Example Page'
    }

    expect(message.UpdatePageInfo).toBe(true)
    expect(message.url).toBe('https://example.com')
    expect(message.title).toBe('Example Page')
  })

  it('should accept valid message with type', () => {
    const message: Message = { type: 'custom-type' }

    expect(message.type).toBe('custom-type')
  })

  it('should accept valid message with getTabActive flag', () => {
    const message: Message = { getTabActive: true }

    expect(message.getTabActive).toBe(true)
  })

  it('should accept valid message with GetTabStatusList flag', () => {
    const message: Message = { GetTabStatusList: true }

    expect(message.GetTabStatusList).toBe(true)
  })

  it('should accept valid message with GetRemainingTime flag', () => {
    const message: Message = { GetRemainingTime: true }

    expect(message.GetRemainingTime).toBe(true)
  })

  it('should accept valid message with tabId', () => {
    const message: Message = { tabId: 123 }

    expect(message.tabId).toBe(123)
  })

  it('should accept valid message with DeleteTab flag', () => {
    const message: Message = { DeleteTab: true }

    expect(message.DeleteTab).toBe(true)
  })

  it('should accept valid message with GetFreezeTabList flag', () => {
    const message: Message = { GetFreezeTabList: true }

    expect(message.GetFreezeTabList).toBe(true)
  })

  it('should accept valid message with RecoverFreezeTab flag', () => {
    const message: Message = { RecoverFreezeTab: true }

    expect(message.RecoverFreezeTab).toBe(true)
  })

  it('should accept valid message with RecoverTab flag', () => {
    const message: Message = { RecoverTab: true }

    expect(message.RecoverTab).toBe(true)
  })

  it('should accept valid message with RemoveFreezeTab tabId', () => {
    const message: Message = { RemoveFreezeTab: 456 }

    expect(message.RemoveFreezeTab).toBe(456)
  })

  it('should accept valid message with GotoTaskPage flag', () => {
    const message: Message = { GotoTaskPage: true }

    expect(message.GotoTaskPage).toBe(true)
  })

  it('should accept valid message with data', () => {
    const message: Message = { data: { key: 'value' } }

    expect(message.data).toEqual({ key: 'value' })
  })

  it('should accept valid message with GetWhitelist flag', () => {
    const message: Message = { GetWhitelist: true }

    expect(message.GetWhitelist).toBe(true)
  })

  it('should accept valid message with AddToWhitelist domain', () => {
    const message: Message = { AddToWhitelist: 'example.com' }

    expect(message.AddToWhitelist).toBe('example.com')
  })

  it('should accept valid message with RemoveFromWhitelist domain', () => {
    const message: Message = { RemoveFromWhitelist: 'example.com' }

    expect(message.RemoveFromWhitelist).toBe('example.com')
  })

  it('should accept valid message with RestoreAllFrozenTabs flag', () => {
    const message: Message = { RestoreAllFrozenTabs: true }

    expect(message.RestoreAllFrozenTabs).toBe(true)
  })

  it('should accept valid message with SetPageVisible flag', () => {
    const message: Message = { SetPageVisible: true }

    expect(message.SetPageVisible).toBe(true)
  })

  it('should accept valid message with SetPageHidden flag', () => {
    const message: Message = { SetPageHidden: true }

    expect(message.SetPageHidden).toBe(true)
  })

  it('should accept valid message with GetVisibleTabs flag', () => {
    const message: Message = { GetVisibleTabs: true }

    expect(message.GetVisibleTabs).toBe(true)
  })

  it('should accept valid message with multiple properties', () => {
    const message: Message = {
      tabId: 123,
      url: 'https://example.com',
      title: 'Example',
      UpdatePageInfo: true,
      data: { custom: 'data' }
    }

    expect(message.tabId).toBe(123)
    expect(message.url).toBe('https://example.com')
    expect(message.title).toBe('Example')
    expect(message.UpdatePageInfo).toBe(true)
    expect(message.data).toEqual({ custom: 'data' })
  })

  it('should accept empty message', () => {
    const message: Message = {}

    expect(Object.keys(message)).toHaveLength(0)
  })
})

describe('Response Type', () => {
  it('should accept valid response with string response', () => {
    const response: Response = { response: 'success' }

    expect(response.response).toBe('success')
  })

  it('should accept valid response with string array response', () => {
    const response: Response = { response: ['item1', 'item2'] }

    expect(response.response).toEqual(['item1', 'item2'])
  })

  it('should accept valid response with TabStatus array response', () => {
    const tabStatuses: TabStatus[] = [
      {
        tabId: 1,
        url: 'https://example.com',
        icon: 'icon.png',
        title: 'Example',
        lastUseTime: Date.now()
      }
    ]

    const response: Response = { response: tabStatuses }

    expect(response.response).toEqual(tabStatuses)
  })

  it('should accept valid response with FreezeTabStatus array response', () => {
    const freezeTabStatuses: FreezeTabStatus[] = [
      {
        tabId: 1,
        url: 'https://example.com',
        icon: 'icon.png',
        title: 'Example'
      }
    ]

    const response: Response = { response: freezeTabStatuses }

    expect(response.response).toEqual(freezeTabStatuses)
  })

  it('should accept valid response with boolean response', () => {
    const response: Response = { response: true }

    expect(response.response).toBe(true)
  })

  it('should accept valid response with number response', () => {
    const response: Response = { response: 42 }

    expect(response.response).toBe(42)
  })

  it('should accept valid response with number array response', () => {
    const response: Response = { response: [1, 2, 3, 4, 5] }

    expect(response.response).toEqual([1, 2, 3, 4, 5])
  })

  it('should accept valid response with object response', () => {
    const response: Response = {
      response: { url: 'https://example.com', title: 'Example' }
    }

    expect(response.response).toEqual({
      url: 'https://example.com',
      title: 'Example'
    })
  })

  it('should accept valid response with success object response', () => {
    const response: Response = {
      response: { success: true, message: 'Operation completed' }
    }

    expect(response.response).toEqual({
      success: true,
      message: 'Operation completed'
    })
  })

  it('should accept valid response with undefined response', () => {
    const response: Response = { response: undefined }

    expect(response.response).toBeUndefined()
  })

  it('should accept valid response with tabId', () => {
    const response: Response = {
      response: 'success',
      tabId: 123
    }

    expect(response.tabId).toBe(123)
  })

  it('should accept valid response with error', () => {
    const response: Response = {
      response: 'failed',
      error: 'Something went wrong'
    }

    expect(response.error).toBe('Something went wrong')
  })

  it('should accept valid response with all properties', () => {
    const response: Response = {
      response: 'success',
      tabId: 123,
      error: undefined
    }

    expect(response.response).toBe('success')
    expect(response.tabId).toBe(123)
    expect(response.error).toBeUndefined()
  })
})

describe('TabStatus Type', () => {
  it('should create valid TabStatus with required properties', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now()
    }

    expect(tabStatus.tabId).toBe(1)
    expect(tabStatus.url).toBe('https://example.com')
    expect(tabStatus.icon).toBe('icon.png')
    expect(tabStatus.title).toBe('Example')
    expect(tabStatus.lastUseTime).toBeLessThanOrEqual(Date.now())
  })

  it('should create valid TabStatus with optional windowId', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now(),
      windowId: 1
    }

    expect(tabStatus.windowId).toBe(1)
  })

  it('should create valid TabStatus with optional active flag', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now(),
      active: true
    }

    expect(tabStatus.active).toBe(true)
  })

  it('should create valid TabStatus with isVisible flag', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now(),
      isVisible: true
    }

    expect(tabStatus.isVisible).toBe(true)
  })

  it('should create valid TabStatus with visibilityState', () => {
    const visibilityStates = ['visible', 'hidden', 'prerender', 'unloaded'] as const

    visibilityStates.forEach((state) => {
      const tabStatus: TabStatus = {
        tabId: 1,
        url: 'https://example.com',
        icon: 'icon.png',
        title: 'Example',
        lastUseTime: Date.now(),
        visibilityState: state
      }

      expect(tabStatus.visibilityState).toBe(state)
    })
  })

  it('should create valid TabStatus with all optional properties', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now(),
      windowId: 1,
      active: true,
      isVisible: false,
      visibilityState: 'hidden'
    }

    expect(tabStatus.windowId).toBe(1)
    expect(tabStatus.active).toBe(true)
    expect(tabStatus.isVisible).toBe(false)
    expect(tabStatus.visibilityState).toBe('hidden')
  })
})

describe('FreezeTabStatus Type', () => {
  it('should create valid FreezeTabStatus with all required properties', () => {
    const freezeTabStatus: FreezeTabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example'
    }

    expect(freezeTabStatus.tabId).toBe(1)
    expect(freezeTabStatus.url).toBe('https://example.com')
    expect(freezeTabStatus.icon).toBe('icon.png')
    expect(freezeTabStatus.title).toBe('Example')
  })

  it('should create multiple FreezeTabStatus instances', () => {
    const freezeTabStatuses: FreezeTabStatus[] = [
      {
        tabId: 1,
        url: 'https://example.com',
        icon: 'icon1.png',
        title: 'Example 1'
      },
      {
        tabId: 2,
        url: 'https://test.com',
        icon: 'icon2.png',
        title: 'Example 2'
      },
      {
        tabId: 3,
        url: 'https://demo.com',
        icon: 'icon3.png',
        title: 'Example 3'
      }
    ]

    expect(freezeTabStatuses).toHaveLength(3)
    expect(freezeTabStatuses[0].tabId).toBe(1)
    expect(freezeTabStatuses[1].tabId).toBe(2)
    expect(freezeTabStatuses[2].tabId).toBe(3)
  })
})

describe('SendResponse Type', () => {
  it('should define SendResponse as function type', () => {
    const sendResponse: SendResponse = (response?: Response) => {
      // Mock implementation
      return undefined
    }

    expect(typeof sendResponse).toBe('function')
  })

  it('should accept SendResponse with Response parameter', () => {
    const sendResponse: SendResponse = (response?: Response) => {
      expect(response).toBeDefined()
      return undefined
    }

    const mockResponse: Response = { response: 'success' }
    sendResponse(mockResponse)
  })

  it('should accept SendResponse without parameter', () => {
    const sendResponse: SendResponse = (response?: Response) => {
      expect(response).toBeUndefined()
      return undefined
    }

    sendResponse()
  })

  it('should accept SendResponse with complex Response', () => {
    const sendResponse: SendResponse = (response?: Response) => {
      if (response?.response) {
        expect(Array.isArray(response.response)).toBe(true)
      }
      return undefined
    }

    const mockResponse: Response = {
      response: [
        {
          tabId: 1,
          url: 'https://example.com',
          icon: 'icon.png',
          title: 'Example',
          lastUseTime: Date.now()
        }
      ]
    }

    sendResponse(mockResponse)
  })
})

describe('Type Exports', () => {
  it('should export Message type', () => {
    const message: Message = {}

    expect(message).toBeDefined()
    expect(typeof message).toBe('object')
  })

  it('should export Response type', () => {
    const response: Response = { response: 'test' }

    expect(response).toBeDefined()
    expect(typeof response).toBe('object')
  })

  it('should export SendResponse type', () => {
    const sendResponse: SendResponse = () => undefined

    expect(sendResponse).toBeDefined()
    expect(typeof sendResponse).toBe('function')
  })

  it('should export TabStatus type', () => {
    const tabStatus: TabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example',
      lastUseTime: Date.now()
    }

    expect(tabStatus).toBeDefined()
    expect(typeof tabStatus).toBe('object')
  })

  it('should export FreezeTabStatus type', () => {
    const freezeTabStatus: FreezeTabStatus = {
      tabId: 1,
      url: 'https://example.com',
      icon: 'icon.png',
      title: 'Example'
    }

    expect(freezeTabStatus).toBeDefined()
    expect(typeof freezeTabStatus).toBe('object')
  })
})
