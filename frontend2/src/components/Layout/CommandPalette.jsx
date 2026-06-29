import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Compass, LogOut, Moon, Sun, Settings, Code, Sparkles, MessageSquare, Play, HelpCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useSessionStore from '../../store/sessionStore';

export default function CommandPalette({ isOpen, onClose, toggleSidebar }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { isAuthenticated, logout } = useAuthStore();
  const sessionStore = useSessionStore();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const commandItems = [
    {
      category: 'Navigation',
      label: 'Go to Workspace Dashboard',
      icon: Compass,
      shortcut: 'G D',
      action: () => {
        navigate('/dashboard');
        onClose();
      },
    },
    {
      category: 'Navigation',
      label: 'Configure New Session',
      icon: Play,
      shortcut: 'G N',
      action: () => {
        navigate('/session/setup');
        onClose();
      },
    },
    {
      category: 'Workspace Settings',
      label: 'Switch Input Mode: Voice',
      icon: Sparkles,
      shortcut: 'I V',
      action: () => {
        sessionStore.setInputMode('voice');
        onClose();
      },
    },
    {
      category: 'Workspace Settings',
      label: 'Switch Input Mode: Text',
      icon: Code,
      shortcut: 'I T',
      action: () => {
        sessionStore.setInputMode('text');
        onClose();
      },
    },
    {
      category: 'Workspace Settings',
      label: 'Toggle Collapse Sidebar',
      icon: Settings,
      shortcut: 'S B',
      action: () => {
        toggleSidebar();
        onClose();
      },
    },
    {
      category: 'Session Operations',
      label: 'End Current Active Interview',
      icon: LogOut,
      shortcut: 'E S',
      action: () => {
        sessionStore.endSession();
        onClose();
      },
    },
    {
      category: 'Help',
      label: 'Search Settings and Features (Info)',
      icon: HelpCircle,
      shortcut: '?',
      action: () => {
        alert('InterviewAI Developer Console v1.0. Press Enter to navigate or select command shortcut.');
        onClose();
      },
    },
    {
      category: 'Account',
      label: 'Sign Out / Logout Developer Session',
      icon: LogOut,
      shortcut: '⌥ L',
      action: () => {
        logout();
        navigate('/login');
        onClose();
      },
    },
  ];

  // Filter command items based on search input query
  const filteredItems = commandItems.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  // Key Event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle palette open/close with Ctrl+K
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle, let's keep it simple
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, logout, navigate, onClose, toggleSidebar]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
        {/* Backdrop blur overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#000000]/60 backdrop-blur-[6px]"
        />

        {/* Console Box */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
        >
          {/* Input field */}
          <div className="flex items-center gap-3 px-4 border-b border-zinc-800 h-14">
            <Search className="text-zinc-500" size={18} />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none text-white outline-none placeholder-zinc-500 text-sm font-medium h-full"
              placeholder="Search actions, settings, or navigate pages..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
            />
            <kbd className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </div>

          {/* List items */}
          <div className="max-h-[300px] overflow-y-auto py-2">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.label}
                    onClick={() => item.action()}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent size={16} className={isSelected ? 'text-[#a78bfa]' : 'text-zinc-500'} />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium leading-none">{item.label}</span>
                        <span className="text-[10px] text-zinc-500 mt-1 uppercase font-semibold tracking-wider">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Search size={24} className="mb-2 text-zinc-600" />
                <span className="text-sm">No developer command matching "{query}"</span>
              </div>
            )}
          </div>

          {/* Command help footer */}
          <div className="bg-zinc-950 px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              Use arrow keys <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded">↑</kbd>{' '}
              <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded">↓</kbd> to navigate,{' '}
              <kbd className="bg-zinc-900 border border-zinc-800 px-1.5 rounded">Enter</kbd> to execute
            </span>
            <span>Keyboard First</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
