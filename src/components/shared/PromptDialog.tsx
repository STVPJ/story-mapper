import { useState } from 'react'
import { Button } from './Button'

interface PromptDialogProps {
  title: string
  defaultValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  title,
  defaultValue = '',
  confirmLabel = 'Save',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">{title}</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm(value.trim())
            if (e.key === 'Escape') onCancel()
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <Button variant="primary" onClick={() => value.trim() && onConfirm(value.trim())}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
