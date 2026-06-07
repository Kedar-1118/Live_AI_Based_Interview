import './QuestionDisplay.css';

export default function QuestionDisplay({ question, questionIndex, totalQuestions }) {
  return (
    <div className="question-display animate-fade-in" id="question-display">
      <div className="question-header">
        <div className="question-badge">
          <span className="question-number">Question {questionIndex}</span>
          <span className="question-total">of {totalQuestions}</span>
        </div>
        <div className="question-progress-ring">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle
              cx="20" cy="20" r="16"
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth="3"
            />
            <circle
              cx="20" cy="20" r="16"
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - questionIndex / totalQuestions)}`}
              transform="rotate(-90 20 20)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <p className="question-text">{question}</p>
    </div>
  );
}
