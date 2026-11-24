import { requireOptionalNativeModule } from 'expo-modules-core';

/*
 * Bridge to the native Quick Settings tile (android/.../OfficeTileService.kt).
 * The tile itself can't run JS, so the app tells it the current status after every change.
 * Missing on web / Expo Go, in which case these calls do nothing.
 */
const OfficeTile = requireOptionalNativeModule('OfficeTile');

/** status: 'out' | 'in' | 'break' */
export function setTileState(status, subtitle = '') {
  OfficeTile?.setState(status, subtitle);
}
