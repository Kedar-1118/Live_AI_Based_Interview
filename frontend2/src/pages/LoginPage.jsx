import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, AlertTriangle, X, Terminal, Cpu } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030306] px-4 overflow-hidden">
      {/* Background soft orbs */}
      <div className="ambient-glow-purple -top-40 right-10" />
      <div className="ambient-glow-blue bottom-10 left-10" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 80 }}
        className="w-full max-w-[420px] z-10"
      >
        {/* Logo/Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="relative mb-4 group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-950 border border-white/10 text-white">
              <Terminal size={26} className="text-purple-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Initialize <span className="text-cyber-gradient">Workspace</span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono tracking-wider uppercase">Authentication Gate v1.4</p>
        </div>

        {/* Login Form Container */}
        <motion.div
          whileHover={{ y: -1 }}
          transition={{ duration: 0.3 }}
          className="cyber-card rounded-2xl p-8 border border-white/5 relative overflow-hidden"
        >
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 opacity-60" />

          <form onSubmit={handleSubmit} id="login-form" className="space-y-6">
            
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-shake"
                id="login-error"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5 font-heading">Authentication Anomaly</span>
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-red-400 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                Developer Identity (Email)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Mail size={16} className="transition-colors group-focus-within:text-purple-400" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="identity@domain.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-white/5 rounded-xl text-white outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Security Code (Password)
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-white/5 rounded-xl text-white outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              id="btn-login"
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 text-white font-bold text-sm hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-lg shadow-purple-500/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border border-white/30 border-t-white animate-spin shrink-0" />
                  <span className="font-mono text-xs tracking-wider">Syncing Workspace Environment...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} className="text-purple-200" />
                  <span>Mount Terminal Shell</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Registration Redirect */}
          <div className="mt-6 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-xs text-zinc-500">
              Identity signature missing?{' '}
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                Register new node
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
