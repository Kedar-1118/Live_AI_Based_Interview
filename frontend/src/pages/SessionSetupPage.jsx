import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSessionStore from '../../store/sessionStore';
import './SessionSetupPage.css';

const TOPICS = [
  { id: 'Machine Learning', icon: '🧠', label: 'Machine Learning' },
  { id: 'System Design', icon: '🏗️', label: 'System Design' },
  { id: 'DSA', icon: '🔢', label: 'DSA' },
  { id: 'OS', icon: '💻', label: 'Operating Systems' },
  { id: 'Networking', icon: '🌐', label: 'Networking' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', description: 'Fundamental concepts' },
  { id: 'medium', label: 'Medium', description: 'Applied knowledge' },
  { id: 'hard', label: 'Hard', description: 'Expert-level depth' },
];

const DURATIONS = [
  { minutes: 15, label: '15 min', questions: 5 },
  { minutes: 30, label: '30 min', questions: 10 },
  { minutes: 45, label: '45 min', questions: 15 },
];

export default function SessionSetupPage() {
  const [topic, setTopic] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(DURATIONS[1]);
  const { startSession, isLoading, error } = useSessionStore();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!topic) return;
    const sessionId = await startSession(
      topic,
      difficulty,
      duration.minutes,
      duration.questions,
    );
    if (sessionId) {
      navigate(`/session/${sessionId}`);
    }
  };

  return (
    <div className="page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-3" />

      <div className="container setup-container" id="session-setup-page">
        <div className="setup-header animate-fade-in">
          <h1 className="setup-title">Configure Your Interview</h1>
          <p className="setup-subtitle">
            Choose your topic, difficulty, and duration to begin.
          </p>
        </div>

        {/* Topic Selection */}
        <div className="setup-section glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="setup-section-title">
            <span className="setup-step">1</span>
            Select Topic
          </h2>
          <div className="topic-grid">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                className={`topic-card ${topic === t.id ? 'active' : ''}`}
                onClick={() => setTopic(t.id)}
                id={`topic-${t.id.toLowerCase().replace(' ', '-')}`}
              >
                <span className="topic-icon">{t.icon}</span>
                <span className="topic-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="setup-section glass-card animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h2 className="setup-section-title">
            <span className="setup-step">2</span>
            Select Difficulty
          </h2>
          <div className="difficulty-grid">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className={`difficulty-card ${difficulty === d.id ? 'active' : ''}`}
                onClick={() => setDifficulty(d.id)}
                id={`difficulty-${d.id}`}
              >
                <span className={`difficulty-indicator difficulty-${d.id}`} />
                <div>
                  <span className="difficulty-label">{d.label}</span>
                  <span className="difficulty-desc">{d.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selection */}
        <div className="setup-section glass-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="setup-section-title">
            <span className="setup-step">3</span>
            Select Duration
          </h2>
          <div className="duration-grid">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                className={`chip ${duration.minutes === d.minutes ? 'active' : ''}`}
                onClick={() => setDuration(d)}
                id={`duration-${d.minutes}`}
              >
                {d.label} ({d.questions} questions)
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="setup-actions animate-fade-in" style={{ animationDelay: '0.25s' }}>
          {error && (
            <div className="auth-error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-lg setup-start-btn animate-pulse-glow"
            onClick={handleStart}
            disabled={!topic || isLoading}
            id="btn-start-interview"
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                Setting up interview...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6 4L16 10L6 16V4Z" fill="currentColor"/>
                </svg>
                Start Interview
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
