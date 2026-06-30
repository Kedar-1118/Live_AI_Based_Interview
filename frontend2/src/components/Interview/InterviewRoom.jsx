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
  ArrowRight,
  Terminal,
  Activity
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
      <div className="relative min-h-screen bg-[#030306] overflow-x-hidden w-full flex items-center justify-center py-10 px-4">
        {/* Ambient background glows */}
        <div className="ambient-glow-purple -top-40 right-10" />
        <div className="ambient-glow-blue bottom-10 left-10" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl z-10"
        >
          <div className="cyber-card rounded-2xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 opacity-60" />

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Video size={18} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-white font-heading">
                  Sensor Calibration Setup
                </h2>
                <p className="text-[10px] text-zinc-500 font-mono">Telemetry check and environment modeling</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-mono">
              Establish speaking velocity parameters (WPM) and eye contact tracking vectors to customize proctoring metrics. Please position your face clearly inside the camera box frame.
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
                  <div className="p-5 rounded-xl bg-zinc-950 border border-white/5 relative">
                    <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest font-mono block mb-1">
                      Warm-up Prompt {calibrationStep + 1} of 2
                    </span>
                    <p className="text-sm font-medium text-zinc-200 leading-relaxed font-mono">
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
                <div className="w-10 h-10 rounded-full border border-purple-500/30 border-t-purple-500 animate-spin mb-4" />
                <h3 className="font-semibold text-white mb-1 font-heading">Syncing Tracking Engines</h3>
                <p className="text-xs text-zinc-500 max-w-sm font-mono">
                  Configuring neural thresholds, visual matrices, and audio filters...
                </p>
              </div>
            )}

            {calibrationError && (
              <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-mono">
                {calibrationError}
              </div>
            )}

            <div className="flex items-center justify-center mt-8 pt-6 border-t border-white/[0.04]">
              <button
                onClick={() => skipCalibrationAndSetupDefaultBaseline(sessionId)}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 cursor-pointer bg-zinc-950/60 hover:bg-zinc-950 border border-white/5 px-4 py-2 rounded-xl transition-all"
                id="btn-skip-calibration"
              >
                ⏩ Skip Calibration & Inject Default Vectors
              </button>
            </div>
          </div>
        </motion.div>

        {/* Hidden proctoring engine feed in corner during calibration */}
        <div className="fixed bottom-6 right-6 z-20 w-44">
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
      <div className="relative min-h-screen bg-[#030306] overflow-x-hidden w-full flex items-center justify-center py-10 px-4">
        <div className="ambient-glow-purple -top-40 right-10" />
        <div className="ambient-glow-blue bottom-10 left-10" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl z-10"
          id="session-complete"
        >
          <div className="cyber-card rounded-2xl p-8 border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 opacity-60" />
            
            {/* Header Success */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 dot-blink">
                <CheckCircle size={26} />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Session Evaluation Log Completed</h2>
              <p className="text-xs text-zinc-500 max-w-sm mt-1 font-mono">
                Performance stats and visual proctoring diagnostics successfully processed.
              </p>
            </div>

            {/* Overall Score Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block mb-1">Answered Count</span>
                <span className="text-lg font-bold font-mono text-zinc-200">{scores.length} Questions</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block mb-1">Average Grade</span>
                <span className={`text-lg font-bold font-mono ${
                  avgScore >= 7 ? 'text-emerald-400' : avgScore >= 5 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {avgScore.toFixed(1)}/10
                </span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block mb-1">Integrity Score</span>
                <span className={`text-lg font-bold font-mono ${
                  integrityScore >= 85 ? 'text-emerald-400' : integrityScore >= 70 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {integrityScore}%
                </span>
              </div>
            </div>

            {/* Behavioral Integrity timelines */}
            {loadingReport ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 rounded-full border border-purple-500/30 border-t-purple-500 animate-spin mb-2" />
                <span className="text-[10px] text-zinc-500 font-mono">Querying integrity flags database...</span>
              </div>
            ) : report ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-purple-400" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Integrity Timeline verdict</h3>
                </div>
                
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span>Final Verdict: <strong className={report.verdict === 'EXCELLENT' ? 'text-emerald-400' : 'text-amber-400'}>{report.verdict}</strong></span>
                    <span>Correlation Rate: <strong className="text-purple-400">{report.pattern_analysis.gaze_fluency_correlation}</strong></span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed border-t border-white/[0.04] pt-3">
                    {report.pattern_analysis.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Activity size={14} className="text-purple-400" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Session Timeline Anomalies</h3>
                </div>
                
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {report.timeline.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-zinc-950/40 border border-white/5 space-y-3 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300 truncate max-w-sm">
                          {item.question_index === 0 ? 'Calibration Baseline' : `Q${item.question_index}: ${item.question}`}
                        </span>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${
                          item.suspicion_level === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          item.suspicion_level === 'moderate' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.suspicion_level.toUpperCase()}
                        </span>
                      </div>
                      
                      {item.flags.length > 0 ? (
                        <div className="pl-3 border-l-2 border-red-500/30 space-y-2">
                          {item.flags.map((flag, fIdx) => (
                            <div key={fIdx} className="text-[10px] text-red-400">
                              <span className="text-zinc-600 mr-2">[{flag.timestamp}]</span>
                              <strong className="capitalize">{flag.type.replace(/_/g, ' ')}</strong> (Sev: {flag.severity}) — {flag.metadata?.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-400/80 pl-3 border-l-2 border-emerald-500/20">
                          No proctoring flags logged.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Questions Breakdown */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Question Diagnostic Breakdown</h3>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {answeredExchanges.map((exchange) => (
                  <div key={exchange.id} className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 flex items-start justify-between gap-4 font-mono">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">
                          Q{exchange.question_index}
                        </span>
                        <h4 className="text-xs font-semibold text-zinc-300 leading-normal">{exchange.question}</h4>
                      </div>
                      {exchange.score && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className={`text-[9px] px-2 py-0.5 rounded border ${
                            exchange.score.definition_present ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                          }`}>
                            Definition
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded border ${
                            exchange.score.mechanism_explained ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                          }`}>
                            Mechanism
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded border ${
                            exchange.score.example_given ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                          }`}>
                            Example
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded border ${
                            exchange.score.edge_cases_mentioned ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                          }`}>
                            Edge Cases
                          </span>
                        </div>
                      )}
                    </div>
                    {exchange.score && (
                      <div className={`px-2.5 py-1 rounded-lg border font-bold text-xs shrink-0 ${getScoreBg(exchange.score.technical_accuracy)}`}>
                        {exchange.score.technical_accuracy}/10
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Back action */}
            <div className="flex items-center justify-end pt-5 border-t border-white/[0.04]">
              <button
                onClick={handleBackToDashboard}
                className="relative inline-flex items-center gap-2 py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer group overflow-hidden"
                id="btn-back-dashboard"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span>Return to Workspace</span>
                <ArrowRight size={12} />
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Active Interview View ─────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#030306] overflow-x-hidden w-full flex flex-col md:flex-row">
      
      {/* Workspace Sidebar placeholder space */}
      <div className="flex-1 md:pl-24 lg:pl-[260px] flex flex-col min-h-screen relative" id="interview-room">
        
        {/* TOP BAR / Header */}
        <header className="h-16 border-b border-white/[0.04] px-6 flex items-center justify-between z-20 bg-zinc-950/60 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${
              session?.difficulty === 'easy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              session?.difficulty === 'hard' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {session?.difficulty || 'medium'}
            </span>
            <span className="text-zinc-700 font-mono">/</span>
            <span className="text-xs font-semibold text-zinc-300 font-mono">{session?.topic}</span>
            <span className="text-zinc-700 font-mono">/</span>
            
            {/* Integrity Score HUD */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                integrityScore >= 85 ? 'bg-emerald-500 dot-blink' :
                integrityScore >= 70 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
              }`} />
              <span className="text-[10px] font-bold text-zinc-400 font-mono">
                🔒 INTEGRITY: <span className={
                  integrityScore >= 85 ? 'text-emerald-400' :
                  integrityScore >= 70 ? 'text-amber-400' : 'text-red-400'
                }>{integrityScore}%</span>
              </span>
            </div>

            {/* Adaptive Memory widget */}
            {exchanges.some(e => e.answer_transcript) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[9px] px-2.5 py-0.5 rounded-full font-mono font-medium">
                <Brain size={10} className="shrink-0 text-purple-400" />
                Adaptive Memory Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold text-zinc-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
              {questionIndex} / {totalQuestions}
            </span>
            <button
              onClick={handleEndSession}
              id="btn-end-session"
              className="text-[10px] font-mono font-semibold text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              End Session
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
            <div className="cyber-card rounded-2xl p-6 border border-white/5 shadow-xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
              
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">Terminal Response Console</h3>
                
                {/* Input Toggle Options */}
                <div className="bg-zinc-950 p-0.5 rounded-lg flex items-center border border-white/5">
                  <button
                    onClick={() => setInputMode('voice')}
                    className={`text-[9px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer font-mono ${
                      inputMode === 'voice' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🎤 Voice
                  </button>
                  <button
                    onClick={() => setInputMode('text')}
                    className={`text-[9px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer font-mono ${
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
                    className="w-full min-h-[140px] p-4 bg-zinc-950/80 border border-white/5 rounded-xl text-zinc-100 outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-xs font-mono leading-relaxed transition-all resize-none"
                    placeholder="Type your response structure here... (Press Ctrl + Enter to submit answer payload)"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-500">
                      Shortcut: <kbd className="bg-zinc-900 px-1 rounded text-zinc-400">Ctrl</kbd> + <kbd className="bg-zinc-900 px-1.5 rounded text-zinc-400">Enter</kbd>
                    </span>
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answerText.trim() || isSubmitting}
                      id="btn-submit-answer"
                      className="relative inline-flex items-center justify-center py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin shrink-0 mr-1.5" />
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
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-mono animate-shake">
                  {error}
                </div>
              )}
            </div>

            {/* Evaluation Summary Report (Fades in) */}
            <AnimatePresence>
              {showEvaluation && latestEvaluation && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cyber-card rounded-2xl p-6 border border-white/5 shadow-xl space-y-6 relative overflow-hidden"
                  id="evaluation-panel"
                >
                  <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
                  
                  <div className="flex items-start justify-between border-b border-white/[0.04] pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">Diagnostic Report</h3>
                      <p className="text-[9px] text-zinc-500 font-mono mt-0.5">Real-time rubric semantic diagnostics matches</p>
                    </div>
                    <div className={`px-3 py-1 rounded-xl border font-bold font-mono text-xs ${getScoreBg(latestEvaluation.technical_accuracy)}`}>
                      Grade: {latestEvaluation.technical_accuracy}/10
                    </div>
                  </div>

                  {/* Speech analytics report (Voice only) */}
                  {latestSpeechAnalysis && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/60 border border-white/5 font-mono">
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[8px] text-zinc-500 block uppercase">Speaking WPM</span>
                        <span className={`text-sm font-extrabold mt-1 block ${
                          latestSpeechAnalysis.avg_wpm >= 120 && latestSpeechAnalysis.avg_wpm <= 180 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {Math.round(latestSpeechAnalysis.avg_wpm)}
                        </span>
                      </div>
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[8px] text-zinc-500 block uppercase">Filler Words</span>
                        <span className={`text-sm font-extrabold mt-1 block ${
                          latestSpeechAnalysis.filler_count <= 2 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {latestSpeechAnalysis.filler_count}
                        </span>
                      </div>
                      <div className="text-center md:border-r border-white/[0.04] last:border-0">
                        <span className="text-[8px] text-zinc-500 block uppercase">Max Pause</span>
                        <span className={`text-sm font-extrabold mt-1 block ${
                          latestSpeechAnalysis.longest_pause_seconds <= 3 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {latestSpeechAnalysis.longest_pause_seconds.toFixed(1)}s
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[8px] text-zinc-500 block uppercase">Confidence</span>
                        <span className={`text-sm font-extrabold mt-1 block ${
                          latestSpeechAnalysis.confidence_proxy >= 0.7 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {Math.round(latestSpeechAnalysis.confidence_proxy * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Speech transcript overlay */}
                  {latestTranscript && (
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-zinc-950/80 border border-white/5">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Speech Transcript Log</span>
                      <p className="text-xs text-zinc-300 italic font-mono leading-relaxed">"{latestTranscript}"</p>
                    </div>
                  )}

                  {/* Rubric evaluation criteria checklist */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    <div className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.definition_present ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.definition_present ? '✓' : '✗'} Definition
                    </div>
                    <div className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.mechanism_explained ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.mechanism_explained ? '✓' : '✗'} Mechanism
                    </div>
                    <div className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.example_given ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.example_given ? '✓' : '✗'} Example
                    </div>
                    <div className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                      latestEvaluation.edge_cases_mentioned ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-red-500/5 text-red-400 border-red-500/10'
                    }`}>
                      {latestEvaluation.edge_cases_mentioned ? '✓' : '✗'} Edge Cases
                    </div>
                  </div>

                  {/* Improvements list */}
                  {latestEvaluation.missing_concepts?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Missing Concepts Detected</span>
                      <div className="flex flex-wrap gap-1.5">
                        {latestEvaluation.missing_concepts.map((c, i) => (
                          <span key={i} className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary commentary paragraph */}
                  <div className="space-y-1.5 border-t border-white/[0.04] pt-4">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Diagnostic Summary</span>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">{latestEvaluation.answer_summary}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Context Panel (Proctoring Cam monitor feed, Warnings log) */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/[0.04] bg-zinc-950/20 p-6 space-y-6 shrink-0 z-10">
            
            {/* Proctoring camera feed widget */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Live Frame Monitor</h3>
              <ProctoringEngine sessionId={sessionId} isCalibrationMode={false} />
            </div>

            {/* Adaptive Memory Context */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-2 relative overflow-hidden font-mono">
              <div className="absolute top-0 left-0 w-12 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
              <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Memory telemetry</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed leading-normal">
                State tracking algorithms are comparing current answers with your weak topics logs to verify accuracy improvements.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
