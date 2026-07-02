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
    { path: '/session/setup', label: 'New Session', icon: PlusCircle, id: 'nav-new-session' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? '72px' : '240px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col fixed top-4 bottom-4 left-4 bg-zinc-950/70 border border-white/[0.04] backdrop-blur-xl rounded-2xl z-50 overflow-hidden select-none"
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.04] h-16 relative overflow-hidden">
          <Link to="/" className="flex items-center gap-3 font-semibold text-white overflow-hidden whitespace-nowrap z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-lg blur-md opacity-30 group-hover:opacity-60 transition-opacity" />
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 text-white shrink-0 overflow-hidden">
                <img src="/icon.png" alt="Logo" className="w-5 h-5 object-contain rounded group-hover:scale-105 transition-transform" />
              </div>
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-sm tracking-tight text-cyber-gradient font-heading"
              >
                InterviewAI
              </motion.span>
            )}
          </Link>
          
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="absolute right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                id={item.id}
                className="relative flex items-center h-11 px-3 rounded-xl transition-all cursor-pointer group"
                style={{
                  color: isActive ? '#ffffff' : '#a1a1aa',
                }}
              >
                {/* Active background glow pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute inset-0 bg-white/[0.03] border border-white/[0.04] rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                
                {/* Active left dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-dot-indicator"
                    className="absolute left-0 w-1 h-5 rounded-r-md bg-purple-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                
                <IconComponent
                  size={18}
                  className={`shrink-0 transition-transform ${
                    isActive ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-300 group-hover:scale-105'
                  }`}
                />
                
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="ml-3.5 text-xs font-semibold tracking-wide font-mono whitespace-nowrap"
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
            className="flex items-center h-11 px-3 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer group"
          >
            <Command size={18} className="shrink-0 transition-transform group-hover:rotate-12" />
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-3.5 flex items-center justify-between flex-1 text-xs font-semibold tracking-wide font-mono"
              >
                <span>Command Menu</span>
                <kbd className="text-[9px] bg-zinc-900 border border-white/5 text-zinc-500 px-1.5 py-0.5 rounded font-mono shadow-inner">
                  Ctrl K
                </kbd>
              </motion.div>
            )}
          </div>
        </nav>

        {/* User Info / Logout */}
        <div className="p-3 border-t border-white/[0.04] bg-white/[0.01]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-white/5">
              <div className="flex flex-col min-w-0 ml-1">
                <span className="text-[11px] font-bold text-white truncate font-heading">
                  {user?.name || 'User'}
                </span>
                <span className="text-[9px] text-zinc-500 truncate font-mono">
                  {user?.email || 'user@example.com'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile Floating Bottom Dock */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 h-16 bg-zinc-950/80 border border-white/5 backdrop-blur-xl rounded-2xl z-50 flex items-center justify-around px-4 shadow-lg shadow-black/50">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              id={item.id}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
                isActive ? 'text-purple-400 bg-white/5 border border-white/5' : 'text-zinc-500'
              }`}
            >
              <IconComponent size={18} />
            </Link>
          );
        })}
        <button
          onClick={onOpenPalette}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-500 active:text-white"
        >
          <Command size={18} />
        </button>
        <button
          onClick={handleLogout}
          id="btn-logout"
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-500 active:text-red-400"
        >
          <LogOut size={18} />
        </button>
      </div>
    </>
  );
}
