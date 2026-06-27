import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSessionStore from '../../store/sessionStore';
import useProctoringStore from '../../store/proctoringStore';
import { sessionAPI } from '../../services/api';
import QuestionDisplay from './QuestionDisplay';
import AudioRecorder from './AudioRecorder';
import ProctoringEngine from './ProctoringEngine';
import './InterviewRoom.css';
import './AudioRecorder.css';

const CALIBRATION_QUESTIONS = [
  'Tell me about yourself and your background.',
  'What are some projects you are currently working on or have completed recently?'
];

export default function InterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [answerText, setAnswerText] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);

  // Post-Session Report state
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const {
    currentQuestion,
    questionIndex,
    totalQuestions,
    latestEvaluation,
    isSubmitting,
    sessionComplete,
    session,
    exchanges,
    submitAnswer,
    submitAudioAnswer,
    endSession,
    resetSession,
    error,
    inputMode,
    setInputMode,
    latestTranscript,
    latestSpeechAnalysis,
  } = useSessionStore();

  const {
    isCalibrated,
    calibrationStep,
    loadBaseline,
    startCalibration,
    submitCalibrationAudio,
    completeCalibration,
    skipCalibrationAndSetupDefaultBaseline,
    integrityScore,
    isProctoringActive,
    setProctoringActive,
    isLoading: isCalibratingStore,
    error: calibrationError,
  } = useProctoringStore();

  // Load baseline on mount
  useEffect(() => {
    if (sessionId) {
      loadBaseline(sessionId).then((baseline) => {
        if (!baseline) {
          startCalibration();
        }
      });
    }
  }, [sessionId, loadBaseline, startCalibration]);

  // Load report when session completes
  useEffect(() => {
    if (sessionComplete && sessionId) {
      setLoadingReport(true);
      sessionAPI.getReport(sessionId)
        .then((res) => {
          setReport(res.data);
          setLoadingReport(false);
        })
        .catch((err) => {
          console.error('Failed to fetch report:', err);
          setLoadingReport(false);
        });
    }
  }, [sessionComplete, sessionId]);

  // Handle audio recording completed
  const handleAudioReady = useCallback(async (audioBlob) => {
    setShowEvaluation(false);
    const result = await submitAudioAnswer(audioBlob);
    if (result) {
      setShowEvaluation(true);
      // Fetch updated integrity details from backend if score changed
      if (result.integrity_score !== undefined) {
        useProctoringStore.getState().setIntegrityScore(result.integrity_score);
      }
    }
  }, [submitAudioAnswer]);

  // Handle calibration speech ready
  const handleCalibrationAudioReady = useCallback(async (audioBlob) => {
    const result = await submitCalibrationAudio(sessionId, audioBlob);
    if (result) {
      const nextStep = useProctoringStore.getState().calibrationStep;
      if (nextStep === 2) {
        // Complete calibration and compute baseline
        await completeCalibration(sessionId);
      }
    }
  }, [sessionId, submitCalibrationAudio, completeCalibration]);

  // Handle text answer submit (fallback)
  const handleSubmitAnswer = async () => {
    if (!answerText.trim() || isSubmitting) return;

    setShowEvaluation(false);
    const result = await submitAnswer(answerText);
    if (result) {
      setAnswerText('');
      setShowEvaluation(true);
    }
  };

  const handleEndSession = async () => {
    await endSession();
  };

  const handleBackToDashboard = () => {
    resetSession();
    navigate('/dashboard');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmitAnswer();
    }
  };

  // ─── Calibration / Baseline Setup View ───────────────────────
  if (!isCalibrated) {
    return (
      <div className="page">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        
        <div className="container interview-container">
          <div className="calibration-box glass-card animate-fade-in" style={{ padding: '36px', marginTop: '40px' }}>
            <h2 className="calibration-title" style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '8px' }}>
              Microphone & Gaze Calibration
            </h2>
            <p className="calibration-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              We need to establish your natural speaking speed (WPM) and baseline eye contact vectors before starting the interview.
            </p>

            {calibrationStep < 2 ? (
              <div className="calibration-step-content animate-fade-in" key={calibrationStep}>
                <div style={{ background: 'rgba(102, 126, 234, 0.08)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(102, 126, 234, 0.2)', marginBottom: '24px' }}>
                  <h4 style={{ color: 'var(--accent-blue)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Warm-up Question {calibrationStep + 1} of 2
                  </h4>
                  <p style={{ fontSize: '1.1rem', fontWeight: '500', lineHeight: '1.5' }}>
                    "{CALIBRATION_QUESTIONS[calibrationStep]}"
                  </p>
                </div>

                <AudioRecorder
                  onAudioReady={handleCalibrationAudioReady}
                  isProcessing={isCalibratingStore}
                  disabled={isCalibratingStore}
                />
              </div>
            ) : (
              <div className="calibration-processing animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px auto', width: '40px', height: '40px', borderWidth: '3px' }} />
                <h3>Calculating Baseline Metrics</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Processing speech, standardizing camera eye-contact parameters, and configuring anomaly filters...
                </p>
              </div>
            )}

            {calibrationError && (
              <div className="auth-error" style={{ marginTop: '16px' }}>
                {calibrationError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => skipCalibrationAndSetupDefaultBaseline(sessionId)}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '8px 16px' }}
                id="btn-skip-calibration"
              >
                ⏩ Skip Calibration & Use Defaults
              </button>
            </div>
          </div>
        </div>

        {/* Calibration proctoring engine feed (visible in corner to collect calibration gaze vectors) */}
        <ProctoringEngine sessionId={sessionId} isCalibrationMode={true} />
      </div>
    );
  }

  // ─── Session Complete View ─────────────────────────────────
  if (sessionComplete) {
    const answeredExchanges = exchanges.filter((e) => e.answer_transcript);
    const scores = answeredExchanges
      .map((e) => e.score?.technical_accuracy)
      .filter(Boolean);
    const avgScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    return (
      <div className="page">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="container interview-container">
          <div className="session-complete glass-card animate-fade-in" id="session-complete">
            <div className="complete-icon animate-float">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="url(#complete-grad)" strokeWidth="3" fill="rgba(56,239,125,0.08)"/>
                <path d="M22 32L28 38L42 24" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="complete-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#11998e"/>
                    <stop offset="100%" stopColor="#38ef7d"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className="complete-title">Interview Complete!</h2>
            <p className="complete-subtitle">
              Here's a summary of your performance and behavioral integrity report.
            </p>

            <div className="complete-stats">
              <div className="complete-stat">
                <span className="complete-stat-value">{scores.length}</span>
                <span className="complete-stat-label">Questions Answered</span>
              </div>
              <div className="complete-stat">
                <span className={`complete-stat-value ${
                  avgScore >= 7 ? 'text-green' : avgScore >= 5 ? 'text-orange' : 'text-red'
                }`}>
                  {avgScore.toFixed(1)}
                </span>
                <span className="complete-stat-label">Average Score</span>
              </div>
              <div className="complete-stat">
                <span className={`complete-stat-value ${
                  integrityScore >= 85 ? 'text-green' : integrityScore >= 70 ? 'text-orange' : 'text-red'
                }`}>
                  {integrityScore}%
                </span>
                <span className="complete-stat-label">Integrity Score</span>
              </div>
            </div>

            {/* Premium Behavioral Integrity Timeline (Post-Session Report) */}
            {loadingReport ? (
              <div style={{ width: '100%', margin: '24px 0', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Loading integrity metrics...</p>
              </div>
            ) : report ? (
              <div className="integrity-report-section" style={{ width: '100%', textAlign: 'left', margin: '24px 0' }}>
                <h3 className="exchange-history-title">Behavioral Integrity Report</h3>
                <div className="exchange-item" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Verdict: <strong className={report.verdict === 'EXCELLENT' ? 'text-green' : 'text-orange'}>{report.verdict}</strong></span>
                    <span>Gaze-Fluency Correlation: <strong>{report.pattern_analysis.gaze_fluency_correlation}</strong></span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {report.pattern_analysis.summary}
                  </p>
                </div>

                <h3 className="exchange-history-title" style={{ marginTop: '24px' }}>Session Timeline & Flags</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.timeline.map((item, idx) => (
                    <div key={idx} className="exchange-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                          {item.question_index === 0 ? 'Calibration & Setup' : `Q${item.question_index}: ${item.question.substring(0, 50)}...`}
                        </span>
                        <span className={`badge badge-${item.suspicion_level === 'high' ? 'hard' : item.suspicion_level === 'moderate' ? 'medium' : 'easy'}`} style={{ fontSize: '0.7rem' }}>
                          {item.suspicion_level.toUpperCase()} SUSPICION
                        </span>
                      </div>
                      
                      {item.flags.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px', borderLeft: '2px solid rgba(245, 87, 108, 0.3)' }}>
                          {item.flags.map((flag, fIdx) => (
                            <div key={fIdx} style={{ fontSize: '0.78rem', color: 'var(--accent-red)' }}>
                              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{flag.timestamp}]</span>
                              <strong>{flag.type.replace(/_/g, ' ')}</strong> (Severity: {flag.severity}) — {flag.metadata?.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-green)', paddingLeft: '12px', borderLeft: '2px solid rgba(56, 239, 125, 0.3)' }}>
                          No flags recorded.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Exchange History */}
            <div className="exchange-history">
              <h3 className="exchange-history-title">Question Breakdown</h3>
              {answeredExchanges.map((exchange, i) => (
                <div key={exchange.id} className="exchange-item animate-slide-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="exchange-q">
                    <span className="exchange-num">Q{exchange.question_index}</span>
                    <span className="exchange-question">{exchange.question}</span>
                  </div>
                  {exchange.score && (
                    <div className="exchange-score-row">
                      <div className={`score-circle score-sm ${
                        exchange.score.technical_accuracy >= 7 ? 'score-high' :
                        exchange.score.technical_accuracy >= 5 ? 'score-mid' : 'score-low'
                      }`}>
                        {exchange.score.technical_accuracy}
                      </div>
                      <div className="exchange-rubric">
                        {exchange.score.definition_present && <span className="rubric-check">✓ Definition</span>}
                        {exchange.score.mechanism_explained && <span className="rubric-check">✓ Mechanism</span>}
                        {exchange.score.example_given && <span className="rubric-check">✓ Example</span>}
                        {exchange.score.edge_cases_mentioned && <span className="rubric-check">✓ Edge Cases</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleBackToDashboard}
              className="btn btn-primary btn-lg"
              id="btn-back-dashboard"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Interview View ─────────────────────────────────
  return (
    <div className="page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="container interview-container" id="interview-room">
        {/* Session Info Bar */}
        <div className="session-info-bar glass-card animate-fade-in">
          <div className="session-info-left">
            <span className={`badge badge-${session?.difficulty || 'medium'}`}>
              {session?.difficulty}
            </span>
            <span className="session-topic-label">{session?.topic}</span>
            
            {/* Week 4: Integrity score widget */}
            <span className={`integrity-score-badge ${
              integrityScore >= 85 ? 'success' : integrityScore >= 70 ? 'warning' : 'danger'
            }`} title="Live behavioral integrity score. Drops if suspicious activities are detected.">
              🔒 Integrity: {integrityScore}%
            </span>

            {/* Week 3: Memory indicator — shows after first answer */}
            {exchanges.some(e => e.answer_transcript) && (
              <span className="memory-indicator" title="Cross-session memory is active — the interviewer uses your past performance to personalize questions">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5s-5-2.24-5-5a5 5 0 0 1 5-5z" />
                  <path d="M12 14c-4 0-7 1.79-7 4v2h14v-2c0-2.21-3-4-7-4z" />
                  <circle cx="18" cy="5" r="3" fill="var(--accent-purple)" stroke="none" />
                </svg>
                Memory Active
              </span>
            )}
          </div>
          <div className="session-info-right">
            <span className="session-progress-text">
              {questionIndex} / {totalQuestions}
            </span>
            <button
              onClick={handleEndSession}
              className="btn btn-ghost btn-sm"
              id="btn-end-session"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Main Interview Area */}
        <div className="interview-main glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Question */}
          {currentQuestion && (
            <QuestionDisplay
              question={currentQuestion}
              questionIndex={questionIndex}
              totalQuestions={totalQuestions}
            />
          )}

          {/* Evaluation Feedback */}
          {showEvaluation && latestEvaluation && (
            <div className="evaluation-panel animate-fade-in" id="evaluation-panel">
              <div className="evaluation-header">
                <h3 className="evaluation-title">Evaluation</h3>
                <div className={`score-circle ${
                  latestEvaluation.technical_accuracy >= 7 ? 'score-high' :
                  latestEvaluation.technical_accuracy >= 5 ? 'score-mid' : 'score-low'
                }`}>
                  {latestEvaluation.technical_accuracy}
                </div>
              </div>

              {/* Speech Analysis Metrics (Voice mode only) */}
              {latestSpeechAnalysis && (
                <div className="speech-metrics">
                  <div className="speech-metric">
                    <span className={`speech-metric-value ${
                      latestSpeechAnalysis.avg_wpm >= 120 && latestSpeechAnalysis.avg_wpm <= 180
                        ? 'metric-good'
                        : latestSpeechAnalysis.avg_wpm >= 80
                          ? 'metric-warning'
                          : 'metric-bad'
                    }`}>
                      {Math.round(latestSpeechAnalysis.avg_wpm)}
                    </span>
                    <span className="speech-metric-label">WPM</span>
                  </div>
                  <div className="speech-metric">
                    <span className={`speech-metric-value ${
                      latestSpeechAnalysis.filler_count <= 2
                        ? 'metric-good'
                        : latestSpeechAnalysis.filler_count <= 5
                          ? 'metric-warning'
                          : 'metric-bad'
                    }`}>
                      {latestSpeechAnalysis.filler_count}
                    </span>
                    <span className="speech-metric-label">Fillers</span>
                  </div>
                  <div className="speech-metric">
                    <span className={`speech-metric-value ${
                      latestSpeechAnalysis.longest_pause_seconds <= 3
                        ? 'metric-good'
                        : latestSpeechAnalysis.longest_pause_seconds <= 6
                          ? 'metric-warning'
                          : 'metric-bad'
                    }`}>
                      {latestSpeechAnalysis.longest_pause_seconds.toFixed(1)}s
                    </span>
                    <span className="speech-metric-label">Longest Pause</span>
                  </div>
                  <div className="speech-metric">
                    <span className={`speech-metric-value ${
                      latestSpeechAnalysis.confidence_proxy >= 0.7
                        ? 'metric-good'
                        : latestSpeechAnalysis.confidence_proxy >= 0.4
                          ? 'metric-warning'
                          : 'metric-bad'
                    }`}>
                      {Math.round(latestSpeechAnalysis.confidence_proxy * 100)}%
                    </span>
                    <span className="speech-metric-label">Confidence</span>
                  </div>
                </div>
              )}

              {/* Transcript (Voice mode) */}
              {latestTranscript && (
                <div className="transcript-section">
                  <p className="transcript-label">Your Answer (Transcribed)</p>
                  <div className="transcript-text">{latestTranscript}</div>
                </div>
              )}

              <div className="evaluation-rubric">
                <div className={`rubric-item ${latestEvaluation.definition_present ? 'rubric-pass' : 'rubric-fail'}`}>
                  {latestEvaluation.definition_present ? '✓' : '✗'} Definition
                </div>
                <div className={`rubric-item ${latestEvaluation.mechanism_explained ? 'rubric-pass' : 'rubric-fail'}`}>
                  {latestEvaluation.mechanism_explained ? '✓' : '✗'} Mechanism
                </div>
                <div className={`rubric-item ${latestEvaluation.example_given ? 'rubric-pass' : 'rubric-fail'}`}>
                  {latestEvaluation.example_given ? '✓' : '✗'} Example
                </div>
                <div className={`rubric-item ${latestEvaluation.edge_cases_mentioned ? 'rubric-pass' : 'rubric-fail'}`}>
                  {latestEvaluation.edge_cases_mentioned ? '✓' : '✗'} Edge Cases
                </div>
              </div>

              {latestEvaluation.missing_concepts?.length > 0 && (
                <div className="evaluation-missing">
                  <span className="evaluation-missing-label">Could improve:</span>
                  {latestEvaluation.missing_concepts.map((c, i) => (
                    <span key={i} className="missing-tag">{c}</span>
                  ))}
                </div>
              )}

              <p className="evaluation-summary">{latestEvaluation.answer_summary}</p>
            </div>
          )}

          {/* Answer Input — Voice or Text */}
          <div className="answer-section">
            {inputMode === 'voice' ? (
              <AudioRecorder
                onAudioReady={handleAudioReady}
                isProcessing={isSubmitting}
                disabled={!currentQuestion}
              />
            ) : (
              <>
                <label className="label" htmlFor="answer-input">Your Answer</label>
                <textarea
                  id="answer-input"
                  className="input textarea"
                  placeholder="Type your answer here... (Ctrl+Enter to submit)"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                />

                <div className="answer-actions">
                  <span className="answer-hint">
                    Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitAnswer}
                    disabled={!answerText.trim() || isSubmitting}
                    id="btn-submit-answer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                           <path d="M16 2L8 10M16 2L11 16L8 10M16 2L2 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Submit Answer
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="auth-error" style={{ marginTop: '12px' }}>
                {error}
              </div>
            )}

            {/* Input Mode Toggle */}
            <div className="input-mode-toggle">
              <button
                className={inputMode === 'voice' ? 'active' : ''}
                onClick={() => setInputMode('voice')}
              >
                🎤 Voice
              </button>
              <div className="toggle-divider" />
              <button
                className={inputMode === 'text' ? 'active' : ''}
                onClick={() => setInputMode('text')}
              >
                ⌨️ Text
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Proctoring camera feed in the corner */}
      <ProctoringEngine sessionId={sessionId} isCalibrationMode={false} />
    </div>
  );
}
