import { useEffect, useRef, useState } from 'react';
import useProctoringStore from '../../store/proctoringStore';
import useMediaPipe from '../../hooks/useMediaPipe';
import useWebSocket from '../../hooks/useWebSocket';
import './InterviewRoom.css';

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
          // Send signal to WebSocket every 2 seconds
          // Wait, sendFrame runs at 10 FPS, so to send every 2s, we can throttle
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
    if (isCalibrationMode) return; // don't enforce fullscreen during calibration instructions if desired, or enforce it. Let's enforce it once proctoring is active.
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
    <div className="proctoring-widget glass-card">
      <div className="proctoring-feed-container">
        <video
          ref={videoRef}
          className="proctoring-video"
          autoPlay
          playsInline
          muted
        />
        <div className="proctoring-overlay">
          <div className="status-dot-container">
            <span className={`status-dot ${isWsConnected && isProctoringActive ? 'active-pulse' : 'inactive'}`} />
            <span className="status-text">
              {isCalibrationMode ? 'Calibration' : isProctoringActive ? 'Proctored' : 'Monitoring Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      {activeWarnings.length > 0 && (
        <div className="proctoring-warnings">
          {activeWarnings.map((warning, i) => (
            <div key={i} className="proctoring-warning animate-shake">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {cameraError && (
        <div className="proctoring-error">
          {cameraError}
        </div>
      )}
    </div>
  );
}
