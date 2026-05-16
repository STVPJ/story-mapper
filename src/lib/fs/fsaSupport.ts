/**
 * Feature-detect the File System Access API. Chromium-only and requires
 * a secure context; Firefox/Safari fall back to IndexedDB transparently.
 */
export function isFsaSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    window.isSecureContext === true
  )
}
