import { useState, useCallback, useEffect, useRef } from 'react';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import { motion } from 'framer-motion';
import { Mic, Square, RefreshCw, AlertCircle } from 'lucide-react';

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
        bars[i] = Math.max(8, Math.min(90, baseHeight + variation + noise));
      }

      // Update DOM directly for performance (avoid React re-renders at 60fps)
      if (barsContainerRef.current) {
        const barElements = barsContainerRef.current.children;
        for (let i = 0; i < barElements.length; i++) {
          if (barElements[i]) {
            barElements[i].style.height = `${bars[i]}%`;
          }
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

  // ─── Processing State ───
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center" id="audio-recorder">
        <div className="relative mb-6">
          {/* Pulsing Loading Rings */}
          <div className="absolute inset-0 rounded-full bg-purple-500/10 scale-150 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute inset-0 rounded-full bg-purple-500/5 scale-125 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="w-16 h-16 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#a78bfa] relative animate-spin">
            <RefreshCw size={24} />
          </div>
        </div>
        <h3 className="text-sm font-bold text-white mb-1">Analyzing Telemetry Stream</h3>
        <p className="text-xs text-zinc-500 max-w-sm mb-4">
          Transcribing speech waveform, analyzing cadence intervals, and grading technical semantic rubric checks...
        </p>
        
        <div className="flex flex-col items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
            <span>Transcribing vocal audio bytes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
            <span>Calculating speech rate / filler cadence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
            <span>Evaluating answer against rubric metrics</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Recording State ───
  if (isRecording) {
    return (
      <div className="flex flex-col items-center py-6" id="audio-recorder">
        
        {/* Rec badge & duration */}
        <div className="flex items-center gap-3 mb-6 bg-red-500/5 border border-red-500/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono">Recording</span>
          <span className="text-[10px] text-zinc-400 font-mono font-bold">{formattedDuration}</span>
        </div>

        {/* Live Audio Waveform */}
        <div className="flex items-center justify-center gap-1 h-14 w-full max-w-sm mb-6" ref={barsContainerRef}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="w-1 bg-[#8b5cf6] rounded-full transition-all" style={{ height: '10%', opacity: 0.6 + (i % 5) * 0.08 }} />
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleStopRecording}
            id="btn-stop-recording"
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 border border-red-700 text-white rounded-xl font-semibold text-xs shadow-lg shadow-red-500/10 cursor-pointer transition-colors"
          >
            <Square size={12} className="fill-current text-white" />
            <span>Stop Recording</span>
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">
            Press <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-400">Space</kbd> to finish
          </span>
        </div>
      </div>
    );
  }

  // ─── Idle State ───
  return (
    <div className="flex flex-col items-center py-6" id="audio-recorder">
      {permissionDenied && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4 font-mono">
          <AlertCircle size={14} className="shrink-0" />
          <span>Microphone access denied. Please enable mic permissions.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4 font-mono">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleStartRecording}
          disabled={disabled}
          id="btn-start-recording"
          className="relative w-16 h-16 rounded-full bg-white/[0.02] border border-white/10 hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/5 flex items-center justify-center text-[#a78bfa] cursor-pointer transition-all shadow-md group disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {/* Hover pulse indicators */}
          <div className="absolute inset-0 rounded-full border border-[#8b5cf6]/20 scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300" />
          <Mic size={24} className="transition-transform group-hover:scale-105" />
        </button>

        <div className="text-center space-y-1">
          <span className="text-xs font-bold text-zinc-300 block">Click to start vocal response</span>
          <span className="text-[10px] text-zinc-500 font-mono">
            or press <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-400">Space</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
