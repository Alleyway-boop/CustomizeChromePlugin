# CustomizeChromePlugin - Chrome Tab Manager

## Project Overview

A Chrome/Firefox extension for intelligent tab management and system resource optimization. Automatically freezes inactive tabs to save memory while allowing whitelisted sites to remain active.

**Key Features:**
- Tab freeze/unfreeze functionality
- Real-time active tab detection
- Whitelist management
- One-click unfreeze all tabs
- Page Visibility API integration

## Architecture & Technology Stack

### Core Technologies
- **Vue 3** (Composition API) + TypeScript
- **Vite** build system with web extension support
- **UnoCSS** for utility-first styling
- **Naive UI** component library
- **WebExtension Polyfill** for cross-browser compatibility

### Build System
- **Vite** with `vite-plugin-web-extension` for extension packaging
- **TypeScript** with strict configuration
- **Vue-TSC** for type checking
- Custom build script for post-processing (`CallReplaceScript.cjs`)

### Extension Architecture

#### Chrome Extension Entry Points
- **Background Script**: `background.ts` - Core tab management logic, message handling
- **Content Script**: `content.ts` - Page visibility tracking, tab status reporting
- **Popup UI**: `popup.html` + `popup.ts` - User interface
- **Options Page**: `options.html` + `Option.vue` - Settings management

#### Key Modules

**Background Script (`background.ts`)**:
- Tab status tracking and freeze logic
- Whitelist management
- Message handling system
- Performance optimization with SmartScheduler

**Utilities (`src/utils/`)**:
- `config.ts` - Configuration management with singleton pattern
- `error-handler.ts` - Safe async operations and error handling
- `performance.ts` - Debounce/throttle utilities
- `index.ts` - Message passing helpers

**UI Components (`src/components/`)**:
- `WhitelistManager.vue` - Whitelist interface
- Custom components: `Y-Input.tsx`, `Y-Menu.tsx`, `Y-Slider.tsx`, `Y-Table.tsx`
- Form UI with Naive UI integration

#### State Management
- **Vue 3 Composition API** for reactive state
- **Chrome Storage API** for persistent configuration
- **Singleton pattern** for configuration management (`ConfigManager`)

### Message Passing Architecture
```typescript
// Message types defined in utils/index.ts
interface Message {
  UpdatePageInfo?: boolean;
  UpdateTabStatus?: boolean;
  url?: string;
  title?: string;
  tabId?: number;
  // ... other message types
}

// Background script ↔ Content script ↔ Popup UI communication
```

## Development Workflow

### Scripts
- `npm run dev` - Development server
- `npm run build` - Production build (Vite + TypeScript + post-processing)
- `npm run replace` - Execute custom post-build script
- `npm run Debug` - Debug build

### File Structure
```
src/
├── background.ts          # Extension core logic
├── content.ts           # Page tracking script
├── popup.ts             # Popup entry point
├── options_ui.ts        # Options page entry
├── manifest.json         # Extension manifest
├── components/          # Vue components
│   ├── WhitelistManager.vue
│   └── Y-*.tsx         # Custom UI components
├── modules/             # Feature modules
│   └── BrowserDB/       # Database utilities
├── pages/              # Vue pages
│   ├── Popup.vue       # Main UI
│   └── Option.vue      # Settings page
└── utils/              # Utility modules
    ├── config.ts       # Configuration management
    ├── error-handler.ts # Error handling
    ├── performance.ts  # Performance utilities
    └── index.ts        # Message helpers
```

## Key Patterns & Conventions

### Error Handling
- `safeAsync` wrapper for async operations
- `ExtensionError` custom error class
- Graceful degradation for missing permissions

### Performance Optimization
- **SmartScheduler** for tab monitoring optimization
- **Debounce/throttle** utilities for performance
- Page Visibility API integration
- Configurable monitoring intervals

### Type Safety
- Strict TypeScript configuration
- Web extension types via `@types/webextension-polyfill`
- Vue 3 with Composition API types

## Browser Compatibility

### Chrome Manifest V3
- Service Worker (`background.ts`)
- Extension action with popup
- Content scripts
- Required permissions: `tabs`, `activeTab`, `storage`, `contextMenus`

### Firefox Manifest V2
- Background scripts
- Browser action with popup
- Similar permissions with different names

## Testing & Quality

The project has extensive documentation including:
- **Development Plans** - Roadmap and milestones
- **Technical Reports** - Feature implementations and bug fixes
- **Test Reports** - Performance and functionality testing
- **User Guides** - Chinese and English documentation

## Getting Started

1. Install dependencies: `npm install`
2. Development mode: `npm run dev`
3. Build: `npm run build`
4. Load extension from `dist/` directory in Chrome/Firefox

## Important Notes for Development

- The extension uses Chrome extension APIs with Firefox compatibility layer
- Configuration is persisted using Chrome Storage API
- All async operations should use `safeAsync` wrapper
- UI components use Naive UI with UnoCSS styling
- Build process includes custom post-processing via external script
- Vue 3 Composition API is used throughout for reactive state management
