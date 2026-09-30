import React from 'react'

interface ScoreDisplayProps {
  score: number
  total: number
  streak?: number
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  total,
  streak = 0
}) => {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600">{score}</div>
          <div className="text-sm text-gray-600 mt-1">Correct</div>
        </div>

        <div className="text-center">
          <div className="text-4xl font-bold text-purple-600">{percentage}%</div>
          <div className="text-sm text-gray-600 mt-1">Accuracy</div>
        </div>

        {streak > 0 && (
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-500 flex items-center justify-center">
              <span>{streak}</span>
              <span className="text-2xl ml-1">🔥</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Streak</div>
          </div>
        )}
      </div>

      <div className="mt-4 w-full bg-gray-300 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 text-center text-sm text-gray-600">
        {score} out of {total} questions answered correctly
      </div>
    </div>
  )
}
