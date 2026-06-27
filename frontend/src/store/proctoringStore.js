import { create } from 'zustand';
import { sessionAPI } from '../services/api';

const useProctoringStore = create((set, get) => ({
  isCalibrated: false,
  calibrationStep: 0, // 0: Question 1, 1: Question 2, 2: Finished/Submitting
  calibrationWpms: [],
  calibrationGazeSignals: [], // list of { gaze: {x, y}, head_pose: {yaw, pitch} }
  baseline: null,
  isProctoringActive: false,
  integrityScore: 100,
  activeWarnings: [],
  isLoading: false,
  error: null,

  loadBaseline: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await sessionAPI.getBaseline(sessionId);
      if (response.data) {
        set({
          baseline: response.data,
          isCalibrated: true,
          isLoading: false,
        });
        return response.data;
      }
    } catch (err) {
      // 404 is normal if not calibrated yet
      set({ isCalibrated: false, isLoading: false });
    }
    return null;
  },

  startCalibration: () => {
    set({
      isCalibrated: false,
      calibrationStep: 0,
      calibrationWpms: [],
      calibrationGazeSignals: [],
      activeWarnings: [],
      integrityScore: 100,
    });
  },

  submitCalibrationAudio: async (sessionId, audioBlob) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'calibration.webm');

      const response = await sessionAPI.submitCalibration(sessionId, formData);
      const result = response.data; // { wpm, transcript }

      set((state) => ({
        calibrationWpms: [...state.calibrationWpms, result.wpm || 140.0],
        calibrationStep: state.calibrationStep + 1,
        isLoading: false,
      }));

      return result;
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit calibration speech';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  addGazeSignalDuringCalibration: (signal) => {
    const { gaze, head_pose } = signal;
    if (gaze && head_pose) {
      set((state) => ({
        calibrationGazeSignals: [
          ...state.calibrationGazeSignals,
          { gaze, head_pose },
        ],
      }));
    }
  },

  completeCalibration: async (sessionId) => {
    const { calibrationWpms, calibrationGazeSignals } = get();
    set({ isLoading: true, error: null });

    if (calibrationGazeSignals.length < 5) {
      set({
        error: 'Not enough calibration tracking data captured. Please keep your face in frame.',
        isLoading: false,
      });
      return false;
    }

    try {
      // 1. Calculate WPM baseline
      const wpmSamples = calibrationWpms.length > 0 ? calibrationWpms : [140.0, 150.0];
      const avgWpm = wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length;
      let wpmStdDev = Math.sqrt(
        wpmSamples.reduce((sum, val) => sum + Math.pow(val - avgWpm, 2), 0) / wpmSamples.length
      );
      if (wpmStdDev < 5.0) wpmStdDev = 15.0; // sensible default standard deviation

      // 2. Calculate Gaze metrics
      const gazeXValues = calibrationGazeSignals.map((s) => s.gaze.x);
      const gazeYValues = calibrationGazeSignals.map((s) => s.gaze.y);

      const gazeCenterX = gazeXValues.reduce((a, b) => a + b, 0) / gazeXValues.length;
      const gazeCenterY = gazeYValues.reduce((a, b) => a + b, 0) / gazeYValues.length;

      // Distance deviation from center for each frame
      const gazeDeviations = calibrationGazeSignals.map((s) => {
        const dx = s.gaze.x - gazeCenterX;
        const dy = s.gaze.y - gazeCenterY;
        return Math.sqrt(dx * dx + dy * dy);
      });

      // Standard deviation of deviations
      const avgGazeDev = gazeDeviations.reduce((a, b) => a + b, 0) / gazeDeviations.length;
      let gazeStdDev = Math.sqrt(
        gazeDeviations.reduce((sum, val) => sum + Math.pow(val - avgGazeDev, 2), 0) / gazeDeviations.length
      );
      if (gazeStdDev < 0.03) gazeStdDev = 0.08; // sensible minimum to avoid false positives

      // 3. Calculate Head Pose ranges
      const yawValues = calibrationGazeSignals.map((s) => s.head_pose.yaw);
      const pitchValues = calibrationGazeSignals.map((s) => s.head_pose.pitch);

      const minYaw = Math.min(...yawValues);
      const maxYaw = Math.max(...yawValues);
      const minPitch = Math.min(...pitchValues);
      const maxPitch = Math.max(...pitchValues);

      const baselineData = {
        avg_wpm: Math.round(avgWpm * 10) / 10,
        wpm_std_dev: Math.round(wpmStdDev * 10) / 10,
        gaze_center_x: Math.round(gazeCenterX * 1000) / 1000,
        gaze_center_y: Math.round(gazeCenterY * 1000) / 1000,
        gaze_std_dev: Math.round(gazeStdDev * 1000) / 1000,
        head_pose_range: {
          yaw: [Math.round(minYaw * 10) / 10, Math.round(maxYaw * 10) / 10],
          pitch: [Math.round(minPitch * 10) / 10, Math.round(maxPitch * 10) / 10],
        },
      };

      await sessionAPI.completeCalibration(sessionId, baselineData);

      // Load it back
      const baselineResponse = await sessionAPI.getBaseline(sessionId);

      set({
        baseline: baselineResponse.data,
        isCalibrated: true,
        isProctoringActive: true,
        isLoading: false,
      });

      return true;
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to complete calibration';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  skipCalibrationAndSetupDefaultBaseline: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const defaultBaselineData = {
        avg_wpm: 140.0,
        wpm_std_dev: 15.0,
        gaze_center_x: 0.5,
        gaze_center_y: 0.5,
        gaze_std_dev: 0.08,
        head_pose_range: {
          yaw: [-15.0, 15.0],
          pitch: [-15.0, 15.0],
        },
      };

      await sessionAPI.completeCalibration(sessionId, defaultBaselineData);

      const baselineResponse = await sessionAPI.getBaseline(sessionId);

      set({
        baseline: baselineResponse.data,
        isCalibrated: true,
        isProctoringActive: true,
        isLoading: false,
      });

      return true;
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to skip calibration';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  setProctoringActive: (active) => set({ isProctoringActive: active }),
  setIntegrityScore: (score) => set({ integrityScore: score }),

  addWarning: (warning) => {
    set((state) => {
      if (state.activeWarnings.includes(warning)) return {};
      return { activeWarnings: [...state.activeWarnings, warning] };
    });
  },

  removeWarning: (warning) => {
    set((state) => ({
      activeWarnings: state.activeWarnings.filter((w) => w !== warning),
    }));
  },

  clearError: () => set({ error: null }),
}));

export default useProctoringStore;
