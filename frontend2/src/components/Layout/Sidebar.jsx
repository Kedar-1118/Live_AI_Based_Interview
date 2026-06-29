import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, PlusCircle, LogOut, ChevronLeft, ChevronRight, Terminal, Command } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Sidebar({ isCollapsed, setIsCollapsed, onOpenPalette }) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  const menuItems = [
    { path: '/dashboard', label: 'Workspace', icon: LayoutDashboard, id: 'nav-dashboard' },
    { path: '/session/setup', label: 'New Interview', icon: PlusCircle, id: 'nav-new-session' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? '72px' : '240px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col fixed top-4 bottom-4 left-4 dev-glass rounded-2xl z-50 overflow-hidden select-none"
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)] h-16">
          <Link to="/" className="flex items-center gap-3 font-semibold text-white overflow-hidden whitespace-nowrap">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] shadow-lg shadow-[rgba(139,92,246,0.3)] shrink-0">
              <Terminal size={18} className="text-white" />
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-semibold text-sm tracking-tight text-gradient"
              >
                InterviewAI
              </motion.span>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="absolute right-4 text-zinc-500 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                id={item.id}
                className="relative flex items-center h-11 px-3 rounded-xl transition-colors cursor-pointer group"
                style={{
                  color: isActive ? '#ffffff' : '#a1a1aa',
                }}
              >
                {/* Active background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute inset-0 bg-white/5 border border-white/5 rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                
                <IconComponent size={20} className={`shrink-0 transition-transform ${isActive ? 'text-[#a78bfa]' : 'group-hover:scale-105'}`} />
                
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="ml-3 text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}

          {/* Quick Command Trigger */}
          <div
            onClick={onOpenPalette}
            className="flex items-center h-11 px-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer group"
          >
            <Command size={20} className="shrink-0 transition-transform group-hover:rotate-12" />
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-3 flex items-center justify-between flex-1 text-sm font-medium"
              >
                <span>Command Menu</span>
                <kbd className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                  Ctrl K
                </kbd>
              </motion.div>
            )}
          </div>
        </nav>

        {/* User Info / Logout */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.06)] bg-white/[0.01]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex flex-col min-w-0 ml-1">
                <span className="text-xs font-semibold text-white truncate">
                  {user?.name || 'User'}
                </span>
                <span className="text-[10px] text-zinc-500 truncate">
                  {user?.email || 'user@example.com'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="p-2 text-zinc-500 hover:text-[#f5576c] hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="p-2.5 text-zinc-500 hover:text-[#f5576c] hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile Floating Bottom Dock */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 h-16 dev-glass rounded-2xl z-50 flex items-center justify-around px-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              id={item.id}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
                isActive ? 'text-[#a78bfa] bg-white/5 border border-white/5' : 'text-zinc-400'
              }`}
            >
              <IconComponent size={20} />
            </Link>
          );
        })}
        <button
          onClick={onOpenPalette}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-400 active:text-white"
        >
          <Command size={20} />
        </button>
        <button
          onClick={handleLogout}
          id="btn-logout"
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-400 active:text-red-400"
        >
          <LogOut size={20} />
        </button>
      </div>
    </>
  );
}
