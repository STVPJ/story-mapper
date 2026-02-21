import { RELEASE_COLOURS } from '../../utils/colours'

interface ColourPickerProps {
  value: string
  onChange: (colour: string) => void
}

export function ColourPicker({ value, onChange }: ColourPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {RELEASE_COLOURS.map((colour) => (
        <button
          key={colour}
          onClick={() => onChange(colour)}
          className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
            value === colour ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-gray-400 scale-110' : ''
          }`}
          style={{ backgroundColor: colour }}
          aria-label={`Select colour ${colour}`}
        />
      ))}
    </div>
  )
}
