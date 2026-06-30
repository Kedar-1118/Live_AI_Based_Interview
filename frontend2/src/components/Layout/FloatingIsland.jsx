import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, UploadCloud, ShieldAlert, Cpu, Lock } from 'lucide-react';
import useSessionStore from '../../store/sessionStore';
import useProctoringStore from '../../store/proctoringStore';
import useAuthStore from '../../store/authStore';

export default function FloatingIsland() {
  const sessionStore = useSessionStore();
  const proctoringStore = useProctoringStore();
  const authStore = useAuthStore();

  const [islandState, setIslandState] = useState('idle'); // 'idle' | 'uploading' | 'saving' | 'success' | 'error' | 'warning'
  const [message, setMessage] = useState('');

  // Derive status from existing Zustand store states
  const isSubmitting = sessionStore.isSubmitting;
  const isSessionLoading = sessionStore.isLoading;
  const isProctoringLoading = proctoringStore.isLoading;
  const authLoading = authStore.isLoading;
  const activeWarnings = proctoringStore.activeWarnings;

  const sessionError = sessionStore.error;
  const proctoringError = proctoringStore.error;
  const authError = authStore.error;

  useEffect(() => {
    // 1. Check for errors
    const errorMsg = sessionError || proctoringError || authError;
    if (errorMsg) {
      setIslandState('error');
      setMessage(errorMsg);
      // Auto dismiss error message after 6 seconds
      const timer = setTimeout(() => {
        setIslandState('idle');
        sessionStore.clearError();
        proctoringStore.clearError();
        authStore.clearError();
      }, 6000);
      return () => clearTimeout(timer);
    }

    // 2. Check for active warnings (highest priority visual flags)
    if (activeWarnings && activeWarnings.length > 0) {
      setIslandState('warning');
      setMessage(activeWarnings[activeWarnings.length - 1]);
      return;
    }

    // 3. Check for background submission/processing (uploading audio)
    if (isSubmitting) {
      setIslandState('uploading');
      setMessage('Analyzing Speech & Evaluating Answer...');
      return;
    }

    // 4. Check for background setup or calibration
    if (isSessionLoading) {
      setIslandState('saving');
      setMessage('Setting up Interview Session...');
      return;
    }

    if (isProctoringLoading) {
      setIslandState('saving');
      setMessage('Processing Speech Analytics Baseline...');
      return;
    }

    if (authLoading) {
      setIslandState('saving');
      setMessage('Authenticating Developer...');
      return;
    }

    // 5. If everything ends and was uploading, show success brief animation
    if (islandState === 'uploading' && !isSubmitting && !errorMsg) {
      setIslandState('success');
      setMessage('Evaluation Completed Successfully');
      const timer = setTimeout(() => {
        setIslandState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Default fall back
    setIslandState('idle');
    setMessage('');
  }, [
    isSubmitting,
    isSessionLoading,
    isProctoringLoading,
    authLoading,
    activeWarnings,
    sessionError,
    proctoringError,
    authError,
    islandState,
    sessionStore,
    proctoringStore,
    authStore
  ]);

  // Framer Motion animation configurations for morphing shapes
  const getIslandVariants = () => {
    switch (islandState) {
      case 'uploading':
        return {
          width: 320,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#0a0a0f',
          borderColor: 'rgba(139, 92, 246, 0.45)',
          boxShadow: '0 0 15px rgba(139, 92, 246, 0.15), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        };
      case 'saving':
        return {
          width: 290,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#0a0a0f',
          borderColor: 'rgba(59, 130, 246, 0.45)',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.12), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        };
      case 'success':
        return {
          width: 320,
          height: 50,
          borderRadius: 25,
          backgroundColor: '#0a0a0f',
          borderColor: 'rgba(16, 185, 129, 0.5)',
          boxShadow: '0 0 15px rgba(16, 185, 129, 0.15), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        };
      case 'warning':
        return {
          width: 360,
          height: 54,
          borderRadius: 16,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.65)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.25), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        };
      case 'error':
        return {
          width: 380,
          height: 54,
          borderRadius: 14,
          backgroundColor: '#0d0707',
          borderColor: 'rgba(239, 68, 68, 0.65)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        };
      default: // idle
        return {
          width: 150,
          height: 38,
          borderRadius: 19,
          backgroundColor: '#030306',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        };
    }
  };

  const renderIcon = () => {
    switch (islandState) {
      case 'uploading':
        return <UploadCloud size={15} className="text-purple-400 animate-pulse" />;
      case 'saving':
        return <Cpu size={15} className="text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />;
      case 'success':
        return <CheckCircle size={15} className="text-emerald-400" />;
      case 'warning':
        return <ShieldAlert size={16} className="text-red-400 animate-bounce" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-400" />;
      default:
        return <Lock size={11} className="text-zinc-500" />;
    }
  };

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none">
      <motion.div
        animate={getIslandVariants()}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="flex items-center justify-center px-4 overflow-hidden border backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 w-full justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={islandState}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center justify-center shrink-0"
            >
              {renderIcon()}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {islandState !== 'idle' ? (
              <motion.span
                key={message}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-semibold text-zinc-300 truncate tracking-wide font-mono max-w-[80%]"
              >
                {message}
              </motion.span>
            ) : (
              <motion.span
                key="secure"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono"
              >
                Secure Link
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
