import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Video, VideoOff } from 'lucide-react';
import useProctoringStore from '../../store/proctoringStore';
import useMediaPipe from '../../hooks/useMediaPipe';
import useWebSocket from '../../hooks/useWebSocket';

export default function ProctoringEngine({ sessionId, isCalibrationMode }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);

  const {
    isProctoringActive,
    isCalibrated,
    calibrationStep,
    addGazeSignalDuringCalibration,
    activeWarnings,
    addWarning,
    removeWarning,
  } = useProctoringStore();

  const { isLoaded: isMediaPipeLoaded, initializeFaceMesh, sendFrame, close: closeMediaPipe } = useMediaPipe();
  const { isConnected: isWsConnected, sendSignal } = useWebSocket(sessionId);

  // 1. Initialize camera stream
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError('Camera access denied. Please grant camera permission to begin the proctored interview.');
        addWarning('Camera connection is required.');
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [addWarning]);

  // 2. Initialize MediaPipe Face Mesh
  useEffect(() => {
    let faceMeshInstance = null;

    async function setupTracker() {
      faceMeshInstance = await initializeFaceMesh((results) => {
        const currentTs = Date.now();

        // Check if we are in calibration mode
        if (isCalibrationMode && calibrationStep < 2) {
          if (results.face_count === 1) {
            addGazeSignalDuringCalibration({
              gaze: results.gaze,
              head_pose: results.head_pose,
              timestamp: currentTs,
            });
          }
        }
        // Active proctoring stream
        else if (isProctoringActive && isCalibrated && isWsConnected) {
          if (!window.__LAST_WS_SIGNAL_TIME__ || currentTs - window.__LAST_WS_SIGNAL_TIME__ >= 2000) {
            window.__LAST_WS_SIGNAL_TIME__ = currentTs;
            sendSignal({
              face_count: results.face_count,
              gaze: results.gaze,
              head_pose: results.head_pose,
              timestamp: currentTs,
            });
          }
        }
      });

      if (faceMeshInstance) {
        // Start processing frames at 10 FPS (100ms)
        frameIntervalRef.current = setInterval(() => {
          if (videoRef.current) {
            sendFrame(videoRef.current);
          }
        }, 100);
      }
    }

    if (isMediaPipeLoaded) {
      setupTracker();
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      closeMediaPipe();
    };
  }, [
    isMediaPipeLoaded,
    isCalibrationMode,
    calibrationStep,
    isProctoringActive,
    isCalibrated,
    isWsConnected,
    initializeFaceMesh,
    sendFrame,
    closeMediaPipe,
    addGazeSignalDuringCalibration,
    sendSignal,
  ]);

  // 3. Fullscreen & Tab Switch Enforcement
  useEffect(() => {
    if (isCalibrationMode) return;
    if (!isProctoringActive) return;

    // Enforce fullscreen
    const requestFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Failed to enter fullscreen mode:', err);
        });
      }
    };

    requestFullscreen();

    // Fullscreen exit handler
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const msg = 'Fullscreen mode exited! Please return to fullscreen.';
        addWarning(msg);
        if (isWsConnected) {
          sendSignal({
            event_type: 'fullscreen_exit',
            severity: 'medium',
            metadata: { message: 'Candidate exited fullscreen mode' },
          });
        }
      } else {
        removeWarning('Fullscreen mode exited! Please return to fullscreen.');
      }
    };

    // Tab Switch / Focus change handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const msg = 'Tab or window switch detected!';
        addWarning(msg);
        if (isWsConnected) {
          sendSignal({
            event_type: 'tab_switch',
            severity: 'medium',
            metadata: { message: 'Candidate switched tabs or window' },
          });
        }
      }
    };

    const handleWindowBlur = () => {
      const msg = 'Window focus lost! Focus returned to interview room.';
      addWarning(msg);
      if (isWsConnected) {
        sendSignal({
          event_type: 'tab_switch',
          severity: 'medium',
          metadata: { message: 'Candidate window focus lost (blur)' },
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isProctoringActive, isWsConnected, sendSignal, addWarning, removeWarning, isCalibrationMode]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900 border border-white/5 shadow-xl flex flex-col">
      {/* Video stream container */}
      <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />

        {/* HUD overlay labels */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 border border-white/5 flex items-center gap-1.5 pointer-events-none">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isWsConnected && isProctoringActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'
          }`} />
          <span className="text-[9px] font-bold text-zinc-300 font-mono tracking-wider">
            {isCalibrationMode ? 'CALIBRATION' : isProctoringActive ? 'PROCTORED' : 'STANDBY'}
          </span>
        </div>

        {/* Camera stream indicator icon */}
        <div className="absolute bottom-2 right-2 text-zinc-500 pointer-events-none">
          {cameraError ? <VideoOff size={12} className="text-red-400" /> : <Video size={12} className="text-emerald-400" />}
        </div>
      </div>

      {/* Embedded warning alerts block */}
      <AnimatePresence>
        {activeWarnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/10 border-t border-red-500/20 p-3 space-y-1.5 overflow-hidden"
          >
            {activeWarnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] text-red-400 font-mono font-medium leading-normal animate-shake">
                <AlertTriangle size={12} className="shrink-0 mt-0.5 text-red-500" />
                <span>{warning}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {cameraError && (
        <div className="bg-red-500/10 border-t border-red-500/20 p-3 text-[10px] font-medium font-mono text-red-400 leading-relaxed text-center">
          {cameraError}
        </div>
      )}
    </div>
  );
}
