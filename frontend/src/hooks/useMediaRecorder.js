import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom React hook wrapping the MediaRecorder API.
 * Provides audio recording, live duration tracking, and real-time audio level.
 *
 * Usage:
 *   const { startRecording, stopRecording, isRecording, duration, audioLevel } = useMediaRecorder();
 */
export default function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _cleanup();
    };
  }, []);

  const _cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // Update audio level via AnalyserNode for waveform visualization
  const _updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Calculate RMS level (0-1)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setAudioLevel(Math.min(1, rms * 3)); // amplify for visibility

    animationFrameRef.current = requestAnimationFrame(_updateAudioLevel);
  }, []);

  /**
   * Start recording audio from the microphone.
   * Requests permission if not already granted.
   */
  const startRecording = useCallback(async () => {
    try {
      setPermissionDenied(false);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Set up audio analysis for visual feedback
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start MediaRecorder
      // Prefer webm/opus for quality + size, fallback to other codecs
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;

      // Capture audio chunks every 5 seconds (per spec)
      mediaRecorder.start(5000);

      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);

      // Start audio level monitoring
      _updateAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }

      _cleanup();
      throw error;
    }
  }, [_updateAudioLevel, _cleanup]);

  /**
   * Stop recording and return the assembled audio Blob.
   * @returns {Promise<Blob>} The final audio blob
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        reject(new Error('Not recording'));
        return;
      }

      mediaRecorder.onstop = () => {
        // Assemble final blob from all chunks
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Cleanup
        _cleanup();
        setIsRecording(false);
        setAudioLevel(0);

        resolve(audioBlob);
      };

      mediaRecorder.onerror = (event) => {
        _cleanup();
        setIsRecording(false);
        setAudioLevel(0);
        reject(event.error || new Error('Recording failed'));
      };

      mediaRecorder.stop();
    });
  }, [_cleanup]);

  /**
   * Format duration in seconds to MM:SS string.
   */
  const formattedDuration = `${Math.floor(duration / 60)
    .toString()
    .padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;

  return {
    startRecording,
    stopRecording,
    isRecording,
    duration,
    formattedDuration,
    audioLevel,
    permissionDenied,
  };
}
