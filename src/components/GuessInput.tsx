import React, { useState } from 'react'

interface GuessInputProps {
  onSubmit: (guess: string) => void
  disabled?: boolean
  placeholder?: string
}

export const GuessInput: React.FC<GuessInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Enter song title or artist name...'
}) => {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input.trim())
      setInput('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          aria-label="Guess input"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          aria-label="Submit guess"
        >
          Submit
        </button>
      </div>
    </form>
  )
}
