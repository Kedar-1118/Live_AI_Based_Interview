import { useState, useCallback, useEffect, useRef } from 'react';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import './AudioRecorder.css';

/**
 * Voice recording UI component for the interview room.
 * States: idle → recording → processing
 * Replaces the text input with a premium voice interface.
 */
export default function AudioRecorder({ onAudioReady, isProcessing, disabled }) {
  const {
    startRecording,
    stopRecording,
    isRecording,
    formattedDuration,
    audioLevel,
    permissionDenied,
  } = useMediaRecorder();

  const [error, setError] = useState(null);
  const waveformBarsRef = useRef(Array(24).fill(0));
  const animFrameRef = useRef(null);
  const barsContainerRef = useRef(null);

  // Animate waveform bars based on audio level
  useEffect(() => {
    if (!isRecording) {
      waveformBarsRef.current = Array(24).fill(0);
      return;
    }

    const animate = () => {
      const bars = waveformBarsRef.current;
      for (let i = 0; i < bars.length; i++) {
        // Create organic waveform by mixing audio level with random variation
        const baseHeight = audioLevel * 100;
        const variation = Math.sin(Date.now() / (200 + i * 30) + i) * 20;
        const noise = Math.random() * 15;
        bars[i] = Math.max(4, Math.min(100, baseHeight + variation + noise));
      }

      // Update DOM directly for performance (avoid React re-renders at 60fps)
      if (barsContainerRef.current) {
        const barElements = barsContainerRef.current.children;
        for (let i = 0; i < barElements.length; i++) {
          barElements[i].style.height = `${bars[i]}%`;
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRecording, audioLevel]);

  const handleStartRecording = useCallback(async () => {
    try {
      setError(null);
      await startRecording();
    } catch (err) {
      setError('Could not access microphone. Please check permissions.');
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      const audioBlob = await stopRecording();
      if (onAudioReady) {
        onAudioReady(audioBlob);
      }
    } catch (err) {
      setError('Recording failed. Please try again.');
    }
  }, [stopRecording, onAudioReady]);

  // Keyboard shortcut: Space to start/stop
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger if not typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (disabled || isProcessing) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (isRecording) {
          handleStopRecording();
        } else {
          handleStartRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, handleStartRecording, handleStopRecording, disabled, isProcessing]);

  // ─── Processing State ────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="audio-recorder audio-recorder-processing animate-fade-in" id="audio-recorder">
        <div className="processing-container">
          <div className="processing-rings">
            <div className="processing-ring processing-ring-1" />
            <div className="processing-ring processing-ring-2" />
            <div className="processing-ring processing-ring-3" />
            <div className="processing-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3V7M14 21V25M3 14H7M21 14H25M6.1 6.1L8.93 8.93M19.07 19.07L21.9 21.9M6.1 21.9L8.93 19.07M19.07 8.93L21.9 6.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <h3 className="processing-title">Analyzing Your Answer</h3>
          <p className="processing-subtitle">
            Transcribing speech, analyzing delivery, evaluating content...
          </p>
          <div className="processing-steps">
            <div className="processing-step processing-step-active">
              <div className="step-dot" />
              <span>Transcribing audio</span>
            </div>
            <div className="processing-step">
              <div className="step-dot" />
              <span>Analyzing speech patterns</span>
            </div>
            <div className="processing-step">
              <div className="step-dot" />
              <span>Evaluating answer quality</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Recording State ─────────────────────────────────────
  if (isRecording) {
    return (
      <div className="audio-recorder audio-recorder-recording animate-fade-in" id="audio-recorder">
        <div className="recording-header">
          <div className="recording-indicator">
            <div className="recording-dot" />
            <span className="recording-label">Recording</span>
          </div>
          <span className="recording-duration">{formattedDuration}</span>
        </div>

        {/* Waveform Visualization */}
        <div className="waveform-container" ref={barsContainerRef}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="waveform-bar" style={{ height: '4%' }} />
          ))}
        </div>

        <div className="recording-actions">
          <span className="recording-hint">
            Press <kbd>Space</kbd> or click to finish
          </span>
          <button
            className="btn-stop-recording"
            onClick={handleStopRecording}
            id="btn-stop-recording"
          >
            <div className="stop-icon" />
            <span>Done Answering</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Idle State ──────────────────────────────────────────
  return (
    <div className="audio-recorder audio-recorder-idle animate-fade-in" id="audio-recorder">
      {permissionDenied && (
        <div className="recorder-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Microphone access denied. Please enable it in your browser settings.
        </div>
      )}

      {error && (
        <div className="recorder-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      <button
        className="btn-start-recording"
        onClick={handleStartRecording}
        disabled={disabled}
        id="btn-start-recording"
      >
        <div className="mic-icon-container">
          <div className="mic-pulse-ring mic-pulse-ring-1" />
          <div className="mic-pulse-ring mic-pulse-ring-2" />
          <svg className="mic-icon" width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="11" y="4" width="10" height="18" rx="5" stroke="currentColor" strokeWidth="2"/>
            <path d="M7 16C7 20.97 11.03 25 16 25C20.97 25 25 20.97 25 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 25V29M12 29H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="start-label">Click to Start Answering</span>
        <span className="start-hint">or press <kbd>Space</kbd></span>
      </button>
    </div>
  );
}
