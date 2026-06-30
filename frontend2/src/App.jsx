import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './components/Layout/Sidebar';
import FloatingIsland from './components/Layout/FloatingIsland';
import CommandPalette from './components/Layout/CommandPalette';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SessionSetupPage from './pages/SessionSetupPage';
import InterviewRoom from './components/Interview/InterviewRoom';
import LandingPage from './pages/LandingPage';
import useAuthStore from './store/authStore';
import './App.css';

function AppContent() {
  const { isAuthenticated, checkAuth, error: authError, clearError: clearAuthError } = useAuthStore();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const location = useLocation();

  const isLandingPage = location.pathname === '/';

  useEffect(() => {
    checkAuth().finally(() => {
      setCheckingAuth(false);
    });
  }, [checkAuth]);

  // Global key listener for Command Palette (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen bg-[#030306] items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid-bg pointer-events-none z-0" />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border border-purple-500/30 border-t-purple-500 animate-spin" />
            <div className="absolute inset-0 w-10 h-10 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
          <span className="text-zinc-500 text-xs tracking-widest font-mono uppercase">Initializing Telemetry Shell...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`app min-h-screen bg-[#030306] text-zinc-100 relative overflow-hidden ${
      isLandingPage ? 'block' : 'flex flex-col md:flex-row'
    }`}>
      
      {/* Global Matrix Grid overlay */}
      <div className="absolute inset-0 cyber-grid-bg pointer-events-none z-0" />
      
      {/* Background ambient light orbs */}
      <div className="ambient-glow-purple -top-20 right-0" />
      <div className="ambient-glow-blue bottom-0 left-0" />

      {/* Global floating Apple-style Dynamic Island notification center */}
      {!isLandingPage && <FloatingIsland />}

      {/* Ctrl+K Keyboard Search Palette Console */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        toggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* Left Floating Sidebar */}
      {!isLandingPage && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onOpenPalette={() => setIsCommandPaletteOpen(true)}
        />
      )}

      {/* Workspace Routes Router */}
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public authentication gateways */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
          }
        />

        {/* Protected Developer Workspaces */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/setup"
          element={
            <ProtectedRoute>
              <SessionSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <ProtectedRoute>
              <InterviewRoom />
            </ProtectedRoute>
          }
        />

        {/* Fallback Redirection */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
