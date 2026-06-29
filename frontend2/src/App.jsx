import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import useAuthStore from './store/authStore';
import './App.css';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
      <div className="flex min-h-screen bg-[#030303] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner-dev animate-spin" style={{ width: 28, height: 28 }} />
          <span className="text-zinc-500 text-xs tracking-wider font-mono">Initializing Telemetry Shell...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app min-h-screen bg-[#030303] text-zinc-100 flex flex-col md:flex-row relative">
        
        {/* Background ambient light orbs */}
        <div className="glow-bg-orb glow-purple" />
        <div className="glow-bg-orb glow-blue" />

        {/* Global floating Apple-style Dynamic Island notification center */}
        <FloatingIsland />

        {/* Ctrl+K Keyboard Search Palette Console */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          toggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {/* Left Floating Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onOpenPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* Workspace Routes Router */}
        <Routes>
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
    </BrowserRouter>
  );
}

export default App;
