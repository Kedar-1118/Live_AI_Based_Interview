import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Brain,
  Award,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Command,
  Mic,
  FileText,
  Volume2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Video,
  Clock,
  ExternalLink,
  ChevronLeft,
  XCircle,
  ArrowRight
} from 'lucide-react';
import useSessionStore from '../../store/sessionStore';
import useProctoringStore from '../../store/proctoringStore';
import { sessionAPI } from '../../services/api';
import QuestionDisplay from './QuestionDisplay';
import AudioRecorder from './AudioRecorder';
import ProctoringEngine from './ProctoringEngine';

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

  const getScoreBg = (score) => {
    if (score >= 7) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (score >= 5) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-red-500/10 border-red-500/20 text-red-400';
  };

  // ─── Calibration / Baseline Setup View ───────────────────────
  if (!isCalibrated) {
    return (
      <div className="relative min-h-screen bg-[#030303] overflow-hidden flex items-center justify-center">
        <div className="glow-bg-orb glow-purple" />
        <div className="glow-bg-orb glow-blue" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl px-6 z-10"
        >
          <div className="dev-glass rounded-2xl p-8 border border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold tracking-tight text-white mb-2">
              Mic & Eye Tracking Calibration
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Establish speaking velocity parameters (WPM) and camera eye contact vectors to customize anomaly parameters. Keep your face inside the overlay workspace.
            </p>

            {calibrationStep < 2 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={calibrationStep}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono block mb-1">
                      Warm-up prompt {calibrationStep + 1} of 2
                    </span>
                    <p className="text-base font-medium text-zinc-200 leading-relaxed">
                      "{CALIBRATION_QUESTIONS[calibrationStep]}"
                    </p>
                  </div>

                  <AudioRecorder
                    onAudioReady={handleCalibrationAudioReady}
                    isProcessing={isCalibratingStore}
                    disabled={isCalibratingStore}
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="spinner-dev mb-4" style={{ width: 36, height: 36 }} />
                <h3 className="font-semibold text-white mb-1">Syncing Tracking Engines</h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Configuring neural thresholds, visual matrices, and audio filters...
                </p>
              </div>
            )}

            {calibrationError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {calibrationError}
              </div>
            )}

            <div className="flex items-center justify-center mt-6 pt-6 border-t border-white/[0.04]">
              <button
                onClick={() => skipCalibrationAndSetupDefaultBaseline(sessionId)}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                id="btn-skip-calibration"
              >
                ⏩ Skip Calibration & Inject Default Vectors
              </button>
            </div>
          </div>
        </motion.div>

        {/* Hidden proctoring engine feed in corner during calibration */}
        <div className="fixed bottom-6 right-6 z-20">
          <ProctoringEngine sessionId={sessionId} isCalibrationMode={true} />
        </div>
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
      <div className="relative min-h-screen bg-[#030303] overflow-hidden flex items-center justify-center py-10">
        <div className="glow-bg-orb glow-purple" />
        <div className="glow-bg-orb glow-blue" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl px-6 z-10"
          id="session-complete"
        >
          <div className="dev-glass rounded-2xl p-8 border border-white/5 shadow-2xl space-y-8">
            
            {/* Header Success */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 animate-pulse">
                <CheckCircle size={28} />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Session Ended / Evaluation Log</h2>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">
                Your performance stats and visual proctoring logs have been compiled successfully.
              </p>
            </div>

            {/* Overall Score Badges */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1">Answered</span>
                <span className="text-xl font-bold font-mono text-zinc-200">{scores.length} Questions</span>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1">Mock Grade</span>
                <span className={`text-xl font-bold font-mono ${
                  avgScore >= 7 ? 'text-emerald-400' : avgScore >= 5 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {avgScore.toFixed(1)}/10
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1">Integrity Score</span>
                <span className={`text-xl font-bold font-mono ${
                  integrityScore >= 85 ? 'text-emerald-400' : integrityScore >= 70 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {integrityScore}%
                </span>
              </div>
            </div>

            {/* Behavioral Integrity timelines */}
            {loadingReport ? (
              <div className="flex flex-col items-center py-6">
                <div className="spinner-dev mb-2" />
                <span className="text-xs text-zinc-500">Querying flags database...</span>
              </div>
            ) : report ? (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Behavioral Integrity Report</h3>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                    <span>Verdict: <strong className={report.verdict === 'EXCELLENT' ? 'text-emerald-400' : 'text-amber-400'}>{report.verdict}</strong></span>
                    <span>Gaze-Fluency Correlation: <strong className="text-purple-400">{report.pattern_analysis.gaze_fluency_correlation}</strong></span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed border-t border-white/[0.04] pt-2">
                    {report.pattern_analysis.summary}
                  </p>
                </div>

                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pt-2">Session Timeline & Flags</h3>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {report.timeline.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white/[0.01] border border-white/[0.03] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300 truncate max-w-sm">
                          {item.question_index === 0 ? 'Calibration & Setup' : `Q${item.question_index}: ${item.question}`}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                          item.suspicion_level === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          item.suspicion_level === 'moderate' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.suspicion_level.toUpperCase()}
                        </span>
                      </div>
                      
                      {item.flags.length > 0 ? (
                        <div className="pl-3 border-l-2 border-red-500/30 space-y-1.5">
                          {item.flags.map((flag, fIdx) => (
                            <div key={fIdx} className="text-[11px] text-red-400">
                              <span className="text-zinc-500 mr-2 font-mono">[{flag.timestamp}]</span>
                              <strong className="capitalize">{flag.type.replace(/_/g, ' ')}</strong> (Severity: {flag.severity}) — {flag.metadata?.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400/80 pl-3 border-l-2 border-emerald-500/20">
                          No alerts recorded during this step.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Questions Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Question Breakdown</h3>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {answeredExchanges.map((exchange) => (
                  <div key={exchange.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-purple-500/10 text-[#a78bfa] border border-[#8b5cf6]/20 font-mono px-1.5 py-0.5 rounded">
                          Q{exchange.question_index}
                        </span>
                        <h4 className="text-xs font-semibold text-zinc-300 leading-normal">{exchange.question}</h4>
                      </div>
                      {exchange.score && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
                            exchange.score.definition_present ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-800/20 text-zinc-500 border-zinc-800'
                          }`}>
                            Definition
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
                            exchange.score.mechanism_explained ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-800/20 text-zinc-500 border-zinc-800'
                          }`}>
                            Mechanism
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
                            exchange.score.example_given ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-800/20 text-zinc-500 border-zinc-800'
                          }`}>
                            Example
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
                            exchange.score.edge_cases_mentioned ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-800/20 text-zinc-500 border-zinc-800'
                          }`}>
                            Edge Cases
                          </span>
                        </div>
                      )}
                    </div>
                    {exchange.score && (
                      <div className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs shrink-0 ${getScoreBg(exchange.score.technical_accuracy)}`}>
                        {exchange.score.technical_accuracy}/10
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Back action */}
            <div className="flex items-center justify-end pt-4 border-t border-white/[0.04]">
              <button
                onClick={handleBackToDashboard}
                className="btn-dev btn-dev-primary flex items-center gap-2"
                id="btn-back-dashboard"
              >
                <span>Return to Workspace</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Active Interview View ─────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#030303] overflow-hidden flex flex-col md:flex-row">
      
      {/* Workspace Sidebar placeholders - layout handles sidebar, this handles main space */}
      <div className="flex-1 md:pl-24 lg:pl-[240px] flex flex-col min-h-screen" id="interview-room">
        
        {/* TOP BAR / Header */}
        <header className="h-16 border-b border-white/[0.05] px-6 flex items-center justify-between z-20 bg-zinc-950/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className={`badge-dev text-xs uppercase font-bold tracking-wider font-mono ${
              session?.difficulty === 'easy' ? 'badge-dev-easy' :
              session?.difficulty === 'hard' ? 'badge-dev-hard' :
              'badge-dev-medium'
            }`}>
              {session?.difficulty || 'medium'}
            </span>
            <span className="text-zinc-500 font-semibold">/</span>
            <span className="text-sm font-semibold text-zinc-200">{session?.topic}</span>
            <span className="text-zinc-500 font-semibold">/</span>
            
            {/* Integrity Score HUD */}
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                integrityScore >= 85 ? 'bg-emerald-500 animate-ping' :
                integrityScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-xs font-bold text-zinc-400">
                🔒 Integrity: <span className={
                  integrityScore >= 85 ? 'text-emerald-400' :
                  integrityScore >= 70 ? 'text-amber-400' : 'text-red-400'
                }>{integrityScore}%</span>
              </span>
            </div>

            {/* Adaptive Memory widget */}
            {exchanges.some(e => e.answer_transcript) && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#a78bfa] text-[10px] px-2 py-0.5 rounded-full font-medium">
                <Brain size={10} className="shrink-0" />
                Adaptive Memory Engaged
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded">
              {questionIndex} / {totalQuestions}
            </span>
            <button
              onClick={handleEndSession}
              id="btn-end-session"
              className="text-xs font-semibold text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              End Telemetry
            </button>
          </div>
        </header>

        {/* MAIN SANDBOX PANEL */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Main Interview Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Question Card */}
            {currentQuestion && (
              <QuestionDisplay
                question={currentQuestion}
                questionIndex={questionIndex}
                totalQuestions={totalQuestions}
              />
            )}

            {/* Answer Controls: Audio Recorder Waveform OR Text Editor */}
            <div className="dev-glass rounded-2xl p-6 border border-white/5 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h3 className="text-sm font-bold text-zinc-200">Terminal Response Console</h3>
                
                {/* Input Toggle Options */}
                <div className="bg-white/5 p-0.5 rounded-lg flex items-center border border-white/[0.02]">
                  <button
                    onClick={() => setInputMode('voice')}
                    className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                      inputMode === 'voice' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🎤 Voice
                  </button>
                  <button
                    onClick={() => setInputMode('text')}
                    className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                      inputMode === 'text' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ⌨️ Text
                  </button>
                </div>
              </div>

              {inputMode === 'voice' ? (
                <AudioRecorder
                  onAudioReady={handleAudioReady}
                  isProcessing={isSubmitting}
                  disabled={!currentQuestion}
                />
              ) : (
                <div className="space-y-4">
                  <textarea
                    id="answer-input"
                    className="w-full min-h-[140px] p-4 bg-zinc-950/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm font-mono leading-relaxed transition-all resize-none"
                    placeholder="Type your response structure here... (Press Ctrl + Enter to commit telemetry payload)"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-500">
                      Shortcut: <kbd className="bg-zinc-900 px-1 rounded text-zinc-400">Ctrl</kbd> + <kbd className="bg-zinc-900 px-1.5 rounded text-zinc-400">Enter</kbd>
                    </span>
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answerText.trim() || isSubmitting}
                      id="btn-submit-answer"
                      className="btn-dev btn-dev-primary py-2 px-5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="spinner-dev" />
                          <span>Processing Telemetry...</span>
                        </>
                      ) : (
                        <span>Commit Response</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-mono">
                  {error}
                </div>
              )}
            </div>

            {/* Evaluation Summary Report (Fades in) */}
            <AnimatePresence>
              {showEvaluation && latestEvaluation && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="dev-glass rounded-2xl p-6 border border-white/5 shadow-xl space-y-6"
                  id="evaluation-panel"
                >
                  <div className="flex items-start justify-between border-b border-white/[0.04] pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Evaluation Diagnostics</h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Real-time rubric grading matching speech analysis</p>
                    </div>
                    <div className={`px-3 py-1 rounded-xl border font-bold font-mono text-sm ${getScoreBg(latestEvaluation.technical_accuracy)}`}>
                      Grade: {latestEvaluation.technical_accuracy}/10
                    </div>
                  </div>

                  {/* Speech analytics report (Voice only) */}
                  {latestSpeechAnalysis && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[9px] text-zinc-500 font-mono block uppercase">Speaking WPM</span>
                        <span className={`text-base font-bold font-mono mt-1 block ${
                          latestSpeechAnalysis.avg_wpm >= 120 && latestSpeechAnalysis.avg_wpm <= 180 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {Math.round(latestSpeechAnalysis.avg_wpm)}
                        </span>
                      </div>
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[9px] text-zinc-500 font-mono block uppercase">Filler Words</span>
                        <span className={`text-base font-bold font-mono mt-1 block ${
                          latestSpeechAnalysis.filler_count <= 2 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {latestSpeechAnalysis.filler_count}
                        </span>
                      </div>
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[9px] text-zinc-500 font-mono block uppercase">Max Pause</span>
                        <span className={`text-base font-bold font-mono mt-1 block ${
                          latestSpeechAnalysis.longest_pause_seconds <= 3 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {latestSpeechAnalysis.longest_pause_seconds.toFixed(1)}s
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-zinc-500 font-mono block uppercase">Confidence</span>
                        <span className={`text-base font-bold font-mono mt-1 block ${
                          latestSpeechAnalysis.confidence_proxy >= 0.7 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {Math.round(latestSpeechAnalysis.confidence_proxy * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Speech transcript overlay */}
                  {latestTranscript && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-zinc-950/40 border border-white/[0.02]">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Speech Transcript Log</span>
                      <p className="text-xs text-zinc-300 italic font-mono leading-relaxed">"{latestTranscript}"</p>
                    </div>
                  )}

                  {/* Rubric evaluation criteria checklist */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    <div className={`p-2.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.definition_present ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.definition_present ? '✓' : '✗'} Definition
                    </div>
                    <div className={`p-2.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.mechanism_explained ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.mechanism_explained ? '✓' : '✗'} Mechanism
                    </div>
                    <div className={`p-2.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.example_given ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.example_given ? '✓' : '✗'} Example
                    </div>
                    <div className={`p-2.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.edge_cases_mentioned ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.edge_cases_mentioned ? '✓' : '✗'} Edge Cases
                    </div>
                  </div>

                  {/* Improvements list */}
                  {latestEvaluation.missing_concepts?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Gaps & improvements</span>
                      <div className="flex flex-wrap gap-1.5">
                        {latestEvaluation.missing_concepts.map((c, i) => (
                          <span key={i} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary commentary paragraph */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Feedback Commentary</span>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">{latestEvaluation.answer_summary}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Context Panel (Proctoring Cam monitor feed, Warnings log) */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/[0.05] bg-zinc-950/20 p-6 space-y-6 shrink-0 z-10">
            
            {/* Proctoring camera feed widget */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono mb-3">Live Feed Monitor</h3>
              <ProctoringEngine sessionId={sessionId} isCalibrationMode={false} />
            </div>

            {/* Adaptive Memory Context */}
            <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-2">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Active Memory Logs</h4>
              <p className="text-[11px] text-zinc-500 leading-relaxed leading-normal">
                State tracking algorithms are comparing current answers with your weak topics logs to verify accuracy improvements.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
