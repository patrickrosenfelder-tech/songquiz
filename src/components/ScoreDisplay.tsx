interface ScoreDisplayProps {
  score: number;
  accuracy: number;
  streak: number;
  feedback?: string;
}

export function ScoreDisplay({ score, accuracy, streak, feedback }: ScoreDisplayProps) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Score Card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 shadow-lg">
        <div className="text-gray-100 text-sm font-semibold mb-2">Total Score</div>
        <div className="text-4xl font-bold text-white">{score}</div>
        <div className="text-blue-200 text-xs mt-1">Points earned</div>
      </div>

      {/* Accuracy Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-6 shadow-lg">
        <div className="text-gray-100 text-sm font-semibold mb-2">Accuracy</div>
        <div className="text-4xl font-bold text-white">{accuracy.toFixed(1)}%</div>
        <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-3">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${accuracy}%` }}
            aria-label={`Accuracy: ${accuracy.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Streak Card */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-6 shadow-lg">
        <div className="text-gray-100 text-sm font-semibold mb-2">Hot Streak 🔥</div>
        <div className="text-4xl font-bold text-white">{streak}</div>
        <div className="text-orange-200 text-xs mt-1">Correct in a row</div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className="md:col-span-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-4 shadow-lg">
          <p className="text-white text-center font-medium">{feedback}</p>
        </div>
      )}
    </div>
  );
}
