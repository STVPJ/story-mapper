import { useEffect } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, onConfirm])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
