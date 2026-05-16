import { Button } from '../shared/Button'

/**
 * Shown when the chosen folder already contains StoryMapper map files.
 * Lets the user decide how their in-app maps and the folder's maps
 * should reconcile.
 */
export function ExistingFilesDialog({
  folderCount,
  currentCount,
  onMerge,
  onUseFolder,
  onCancel,
}: {
  folderCount: number
  currentCount: number
  onMerge: () => void
  onUseFolder: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          This folder already has maps
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          It contains <strong>{folderCount}</strong> map
          {folderCount === 1 ? '' : 's'}, and you have{' '}
          <strong>{currentCount}</strong> map
          {currentCount === 1 ? '' : 's'} open here. How would you like to
          continue?
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onMerge}>
            Merge (keep both — your open maps win on conflicts)
          </Button>
          <Button variant="secondary" onClick={onUseFolder}>
            Use the folder&rsquo;s maps (discard the ones open here)
          </Button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
