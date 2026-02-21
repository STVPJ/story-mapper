import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
      <input
        className={`w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
        {...props}
      />
    </div>
  )
}
