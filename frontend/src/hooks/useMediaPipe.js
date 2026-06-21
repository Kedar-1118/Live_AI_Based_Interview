import { useEffect, useRef, useState, useCallback } from 'react';

// Script URLs for MediaPipe Face Mesh
const FACEMESH_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';

export default function useMediaPipe() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const faceMeshRef = useRef(null);
  const isInitializingRef = useRef(false);

  // Dynamically load script
  const loadScript = useCallback(() => {
    if (window.FaceMesh) {
      setIsLoaded(true);
      return Promise.resolve();
    }

    if (isInitializingRef.current) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (window.FaceMesh) {
            clearInterval(check);
            setIsLoaded(true);
            resolve();
          }
        }, 100);
      });
    }

    isInitializingRef.current = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACEMESH_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        setIsLoaded(true);
        isInitializingRef.current = false;
        console.log('MediaPipe Face Mesh library loaded successfully');
        resolve();
      };
      script.onerror = (err) => {
        setError('Failed to load MediaPipe Face Mesh from CDN');
        isInitializingRef.current = false;
        reject(err);
      };
      document.body.appendChild(script);
    });
  }, []);

  const initializeFaceMesh = useCallback(async (onResultsCallback) => {
    await loadScript();

    if (!window.FaceMesh) {
      setError('MediaPipe FaceMesh not found on window object');
      return null;
    }

    try {
      const faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 2,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      faceMesh.onResults((results) => {
        const faceCount = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;
        
        if (faceCount === 0) {
          onResultsCallback({ face_count: 0 });
          return;
        }

        if (faceCount > 1) {
          onResultsCallback({ face_count: faceCount });
          return;
        }

        // Single face detected — calculate gaze and head pose
        const landmarks = results.multiFaceLandmarks[0];
        
        // 1. Gaze vector estimation
        // Iris: Left iris center is landmark 468, right iris center is 473.
        // We use left eye outer corner (33) and inner corner (133), top (159), bottom (145) for left iris.
        // And right eye inner corner (362), outer corner (263), top (386), bottom (374) for right iris.
        const leftIris = landmarks[468];
        const leftOuter = landmarks[33];
        const leftInner = landmarks[133];
        const leftTop = landmarks[159];
        const leftBottom = landmarks[145];

        let gazeX = 0.5;
        let gazeY = 0.5;

        if (leftIris && leftOuter && leftInner && leftTop && leftBottom) {
          const width = Math.abs(leftInner.x - leftOuter.x);
          const height = Math.abs(leftBottom.y - leftTop.y);
          if (width > 0 && height > 0) {
            gazeX = (leftIris.x - leftOuter.x) / width;
            gazeY = (leftIris.y - leftTop.y) / height;
            // Clamp 0 to 1
            gazeX = Math.max(0, Math.min(1, gazeX));
            gazeY = Math.max(0, Math.min(1, gazeY));
          }
        }

        // 2. Head pose estimation
        // Nose tip: 4
        // Left eye corner: 33, Right eye corner: 263, Chin: 152
        const nose = landmarks[4];
        const rightEyeCorner = landmarks[263];
        const leftEyeCorner = landmarks[33];
        const chin = landmarks[152];

        let yaw = 0.0;
        let pitch = 0.0;

        if (nose && rightEyeCorner && leftEyeCorner && chin) {
          const leftDist = Math.abs(nose.x - leftEyeCorner.x);
          const rightDist = Math.abs(nose.x - rightEyeCorner.x);
          const totalHorizontal = leftDist + rightDist;
          if (totalHorizontal > 0) {
            // Scale yaw roughly between -90 and 90 degrees
            yaw = ((leftDist - rightDist) / totalHorizontal) * 90;
          }

          const eyeCenterY = (leftEyeCorner.y + rightEyeCorner.y) / 2;
          const topDist = Math.abs(nose.y - eyeCenterY);
          const bottomDist = Math.abs(nose.y - chin.y);
          const totalVertical = topDist + bottomDist;
          if (totalVertical > 0) {
            // Scale pitch roughly between -90 and 90 degrees (tilted up is negative, down is positive)
            pitch = ((topDist - bottomDist) / totalVertical) * 90;
          }
        }

        onResultsCallback({
          face_count: 1,
          gaze: { x: gazeX, y: gazeY },
          head_pose: { yaw, pitch },
        });
      });

      faceMeshRef.current = faceMesh;
      return faceMesh;
    } catch (err) {
      setError(`Failed to initialize Face Mesh: ${err.message}`);
      console.error(err);
      return null;
    }
  }, [loadScript]);

  const sendFrame = useCallback(async (videoElement) => {
    const faceMesh = faceMeshRef.current;
    if (faceMesh && videoElement && videoElement.readyState >= 2) {
      try {
        await faceMesh.send({ image: videoElement });
      } catch (err) {
        // Suppress send errors which usually occur if element becomes detached
      }
    }
  }, []);

  const close = useCallback(() => {
    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close();
      } catch (err) {
        // already closed
      }
      faceMeshRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return { isLoaded, error, initializeFaceMesh, sendFrame, close };
}
