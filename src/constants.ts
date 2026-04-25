/**
 * Extension Constants
 * All magic numbers extracted to named constants for maintainability
 */

// Activity and Freeze Check Intervals
export const ACTIVITY_CHECK_INTERVAL_MS = 1000 * 30; // 30 seconds
export const FREEZE_CHECK_INTERVAL_MS = 1000 * 60; // 60 seconds
export const CLEANUP_INTERVAL_MS = 1000 * 60 * 60; // 60 minutes

// Timeout Values
export const DEFAULT_FREEZE_TIMEOUT_MINUTES = 20;
export const MIN_FREEZE_TIMEOUT_MINUTES = 1;
export const MAX_FREEZE_TIMEOUT_MINUTES = 360;

// Snapshot Settings
export const SNAPSHOT_QUALITY = 50; // JPEG quality
export const MAX_SNAPSHOT_WIDTH = 1920;
export const SNAPSHOT_CAPTURE_DELAY_MS = 500;

// Tab Restore Settings
export const TAB_RESTORE_DELAY_MS = 1000;

// Activity Throttle Settings
export const ACTIVITY_THROTTLE_MS = 5000; // 5 seconds
export const SCROLL_THROTTLE_MS = 2000; // 2 seconds

// Smart Update Intervals
export const FAST_UPDATE_INTERVAL_MS = 500;
export const INITIAL_UPDATE_INTERVAL_MS = 500;
export const NORMAL_UPDATE_INTERVAL_MS = 1000;
export const MAX_UPDATE_INTERVAL_MS = 10000;
export const SMART_UPDATE_THRESHOLD = 5; // Number of unchanged updates before slowing down

// UI Update Intervals
export const FREEZE_LIST_POLL_INTERVAL_MS = 1000;

// Badge Settings
export const BADGE_ZERO_TEXT = '✓';
export const BADGE_COLOR = '#3b82f6'; // Blue
export const BADGE_TEXT_COLOR = '#ffffff';

// Smart Whitelist Suggestion Settings
export const UNFREEZE_COUNT_THRESHOLD = 3; // Show suggestion after 3+ unfreezes

// Storage Keys
export const STORAGE_KEY_DEBUG_ENABLED = 'debugEnabled';
export const STORAGE_KEY_FREEZE_TIMEOUT = 'FreezeTimeout';
export const STORAGE_KEY_FREEZE_PINNED = 'FreezePinned';
export const STORAGE_KEY_WHITELIST = 'whitelist';
export const STORAGE_KEY_FREEZE_TAB_LIST = 'freezeTabStatusList';
export const STORAGE_KEY_UNFREEZE_COUNTS = 'unfreezeCounts';

// Alarm Names
export const FREEZE_CHECK_ALARM_NAME = 'freezeCheckAlarm';
export const CLEANUP_ALARM_NAME = 'cleanupAlarm';
export const FREEZE_CHECK_PERIOD_MINUTES = 1;
export const CLEANUP_PERIOD_MINUTES = 60;
