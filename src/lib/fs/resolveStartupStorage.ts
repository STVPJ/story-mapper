/**
 * Decides which storage backend to use on cold boot. Pure and
 * dependency-injected so the (regression-sensitive) branching is unit
 * tested without rendering the app. Never throws.
 */
import { queryFsaPermission } from './fsaPermissions'

export type StartupPlan =
  | { kind: 'idb'; notice?: string }
  | { kind: 'supabase' }
  | { kind: 'fs'; handle: FileSystemDirectoryHandle }
  | { kind: 'reconnect'; handle: FileSystemDirectoryHandle }

interface Deps {
  isLocalMode: () => boolean
  isFsaSupported: () => boolean
  loadDirectoryHandle: () => Promise<FileSystemDirectoryHandle | null>
}

export async function resolveStartupStorage(deps: Deps): Promise<StartupPlan> {
  if (!deps.isLocalMode()) return { kind: 'supabase' }

  let handle: FileSystemDirectoryHandle | null = null
  try {
    handle = await deps.loadDirectoryHandle()
  } catch {
    handle = null
  }

  if (!handle || !deps.isFsaSupported()) return { kind: 'idb' }

  const permission = await queryFsaPermission(handle)
  if (permission === 'granted') return { kind: 'fs', handle }
  if (permission === 'prompt') return { kind: 'reconnect', handle }

  return {
    kind: 'idb',
    notice:
      "Couldn't access your maps folder, so we're using browser storage. " +
      'Reconnect the folder from the home screen.',
  }
}
