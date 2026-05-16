/**
 * Typed wrappers around the FSA permission API, which is not in the
 * standard DOM lib. Both never throw -- they resolve `'denied'` on error
 * so callers can branch simply.
 */

interface FsaPermissionHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
}

export async function queryFsaPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  try {
    return await (handle as unknown as FsaPermissionHandle).queryPermission({
      mode: 'readwrite',
    })
  } catch {
    return 'denied'
  }
}

export async function requestFsaPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  try {
    return await (handle as unknown as FsaPermissionHandle).requestPermission({
      mode: 'readwrite',
    })
  } catch {
    return 'denied'
  }
}
