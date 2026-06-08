import { create } from 'zustand';
import { sessionAPI, answerAPI } from '../services/api';

const useSessionStore = create((set, get) => ({
  sessionId: null,
  session: null,
  currentQuestion: null,
  questionIndex: 0,
  totalQuestions: 10,
  exchanges: [],
  latestEvaluation: null,
  isLoading: false,
  isSubmitting: false,
  sessionComplete: false,
  error: null,

  // Week 2 additions
  inputMode: 'voice', // 'voice' | 'text'
  latestTranscript: null,
  latestSpeechAnalysis: null,

  startSession: async (topic, difficulty, durationMinutes, totalQuestions) => {
    set({ isLoading: true, error: null, sessionComplete: false, exchanges: [], latestEvaluation: null, latestTranscript: null, latestSpeechAnalysis: null });
    try {
      const response = await sessionAPI.create({
        topic,
        difficulty,
        duration_minutes: durationMinutes,
        total_questions: totalQuestions,
      });

      const session = response.data;
      const firstExchange = session.exchanges?.[0];

      set({
        sessionId: session.id,
        session,
        currentQuestion: firstExchange?.question || null,
        questionIndex: firstExchange?.question_index || 1,
        totalQuestions: session.total_questions,
        exchanges: session.exchanges || [],
        isLoading: false,
      });

      return session.id;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create session';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  // Original text submit (Week 1 — preserved)
  submitAnswer: async (answerText) => {
    const { sessionId } = get();
    if (!sessionId) return;

    set({ isSubmitting: true, error: null, latestTranscript: null, latestSpeechAnalysis: null });
    try {
      const response = await answerAPI.submit({
        session_id: sessionId,
        answer_text: answerText,
      });

      const result = response.data;

      set((state) => ({
        latestEvaluation: result.evaluation,
        currentQuestion: result.next_question,
        questionIndex: result.session_complete
          ? state.questionIndex
          : result.question_index + 1,
        sessionComplete: result.session_complete,
        isSubmitting: false,
      }));

      // Refresh full session data
      const sessionResponse = await sessionAPI.get(sessionId);
      set({ session: sessionResponse.data, exchanges: sessionResponse.data.exchanges });

      return result;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit answer';
      set({ error: message, isSubmitting: false });
      return null;
    }
  },

  // Week 2: Audio answer submission
  submitAudioAnswer: async (audioBlob) => {
    const { sessionId } = get();
    if (!sessionId) return;

    set({ isSubmitting: true, error: null, latestTranscript: null, latestSpeechAnalysis: null });
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'answer.webm');
      formData.append('session_id', sessionId);

      const response = await answerAPI.submitAudio(formData);
      const result = response.data;

      set((state) => ({
        latestEvaluation: result.evaluation,
        latestTranscript: result.transcript,
        latestSpeechAnalysis: result.speech_analysis,
        currentQuestion: result.next_question,
        questionIndex: result.session_complete
          ? state.questionIndex
          : result.question_index + 1,
        sessionComplete: result.session_complete,
        isSubmitting: false,
      }));

      // Refresh full session data
      const sessionResponse = await sessionAPI.get(sessionId);
      set({ session: sessionResponse.data, exchanges: sessionResponse.data.exchanges });

      return result;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to process audio answer';
      set({ error: message, isSubmitting: false });
      return null;
    }
  },

  endSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;

    try {
      await sessionAPI.end(sessionId);
      set({ sessionComplete: true });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  },

  setInputMode: (mode) => set({ inputMode: mode }),

  resetSession: () => {
    set({
      sessionId: null,
      session: null,
      currentQuestion: null,
      questionIndex: 0,
      totalQuestions: 10,
      exchanges: [],
      latestEvaluation: null,
      isLoading: false,
      isSubmitting: false,
      sessionComplete: false,
      error: null,
      inputMode: 'voice',
      latestTranscript: null,
      latestSpeechAnalysis: null,
    });
  },

  clearError: () => set({ error: null }),
}));

export default useSessionStore;
