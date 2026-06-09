import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashRes, weakRes] = await Promise.all([
        userAPI.dashboard(),
        userAPI.weakTopics().catch(() => ({ data: [] })),
      ]);
      setDashboard(dashRes.data);
      setWeakTopics(weakRes.data || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const classes = {
      easy: 'badge-easy',
      medium: 'badge-medium',
      hard: 'badge-hard',
    };
    return `badge ${classes[difficulty] || 'badge-medium'}`;
  };

  const getStatusBadge = (status) => {
    const classes = {
      active: 'badge-active',
      completed: 'badge-completed',
    };
    return `badge ${classes[status] || ''}`;
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'wt-score-none';
    if (score <= 3) return 'wt-score-critical';
    if (score <= 5) return 'wt-score-weak';
    if (score <= 7) return 'wt-score-moderate';
    return 'wt-score-good';
  };

  const getScoreLabel = (score) => {
    if (score === null || score === undefined) return 'N/A';
    if (score <= 3) return 'Critical';
    if (score <= 5) return 'Weak';
    if (score <= 7) return 'Moderate';
    return 'Strong';
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="container dashboard-loading">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="container dashboard-container" id="dashboard-page">
        {/* Hero Section */}
        <div className="dashboard-hero animate-fade-in">
          <div className="dashboard-hero-text">
            <h1 className="dashboard-greeting">
              Welcome back, <span className="gradient-text">{user?.name || 'there'}</span>
            </h1>
            <p className="dashboard-subtitle">
              Track your progress and start practicing for your next interview.
            </p>
          </div>
          <Link to="/session/setup" className="btn btn-primary btn-lg" id="btn-new-interview">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Interview
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{dashboard?.total_sessions || 0}</span>
              <span className="stat-label">Total Sessions</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{dashboard?.completed_sessions || 0}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">
                {dashboard?.avg_score ? dashboard.avg_score.toFixed(1) : '—'}
              </span>
              <span className="stat-label">Avg Score</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-pink">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{dashboard?.total_questions_answered || 0}</span>
              <span className="stat-label">Questions Answered</span>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="sessions-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="section-header">
            <h2 className="section-title">Recent Sessions</h2>
          </div>

          {dashboard?.recent_sessions?.length > 0 ? (
            <div className="sessions-list">
              {dashboard.recent_sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="session-card glass-card animate-slide-in"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <div className="session-card-left">
                    <h3 className="session-topic">{session.topic}</h3>
                    <div className="session-meta">
                      <span className={getDifficultyBadge(session.difficulty)}>
                        {session.difficulty}
                      </span>
                      <span className={getStatusBadge(session.status)}>
                        {session.status}
                      </span>
                      <span className="session-date">
                        {new Date(session.started_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="session-card-right">
                    <div className="session-progress">
                      <span className="session-progress-label">
                        {session.questions_answered}/{session.total_questions} answered
                      </span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(session.questions_answered / session.total_questions) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                    {session.avg_score !== null && (
                      <div className={`score-circle ${
                        session.avg_score >= 7 ? 'score-high' :
                        session.avg_score >= 5 ? 'score-mid' : 'score-low'
                      }`}>
                        {session.avg_score.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state glass-card">
              <div className="empty-state-icon animate-float">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L28.944 18.056L40 19.672L32 27.472L33.888 38.328L24 33.168L14.112 38.328L16 27.472L8 19.672L19.056 18.056L24 8Z" stroke="var(--accent-blue)" strokeWidth="2" strokeLinejoin="round" fill="rgba(102,126,234,0.1)"/>
                </svg>
              </div>
              <h3 className="empty-state-title">No sessions yet</h3>
              <p className="empty-state-text">Start your first interview practice session to see your progress here.</p>
              <Link to="/session/setup" className="btn btn-primary" id="btn-first-interview">
                Start Your First Interview
              </Link>
            </div>
          )}
        </div>

        {/* Week 3: Weak Topics Heatmap */}
        {weakTopics.length > 0 && (
          <div className="weak-topics-section animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="section-header">
              <h2 className="section-title">Weak Topics</h2>
              <p className="section-subtitle">Areas that need more practice across sessions</p>
            </div>

            <div className="weak-topics-grid">
              {weakTopics.map((wt, index) => (
                <div
                  key={wt.id}
                  className={`weak-topic-card glass-card ${getScoreColor(wt.avg_score)} animate-slide-in`}
                  style={{ animationDelay: `${0.04 * index}s` }}
                >
                  <div className="wt-header">
                    <span className="wt-topic">{wt.topic}</span>
                    <span className={`wt-severity-badge ${getScoreColor(wt.avg_score)}`}>
                      {getScoreLabel(wt.avg_score)}
                    </span>
                  </div>
                  <div className="wt-subtopic">{wt.subtopic || 'General'}</div>
                  <div className="wt-footer">
                    <div className="wt-score-bar">
                      <div
                        className="wt-score-fill"
                        style={{ width: `${((wt.avg_score || 0) / 10) * 100}%` }}
                      />
                    </div>
                    <div className="wt-meta">
                      <span className="wt-avg">{wt.avg_score?.toFixed(1) || '—'}/10</span>
                      <span className="wt-occurrences">
                        {wt.occurrence} {wt.occurrence === 1 ? 'time' : 'times'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
