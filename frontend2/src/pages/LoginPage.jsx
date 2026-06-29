import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, AlertTriangle, X, Terminal } from 'lucide-react';
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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030303] px-4 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(124,58,237,0.12),rgba(255,255,255,0))]" />
      
      {/* Background soft orbs */}
      <div className="glow-bg-orb glow-purple" />
      <div className="glow-bg-orb glow-blue" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
        className="w-full max-w-[420px] z-10"
      >
        {/* Logo/Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] shadow-xl shadow-purple-500/20 mb-4">
            <Terminal size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Welcome Back</h1>
          <p className="text-sm text-zinc-400">Sign in to continue your developer interview prep</p>
        </div>

        {/* Login Form Container */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.3 }}
          className="dev-glass rounded-2xl p-8 border border-white/5 shadow-2xl relative overflow-hidden"
        >
          <form onSubmit={handleSubmit} id="login-form" className="space-y-5">
            
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                id="login-error"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Authentication Failed</span>
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
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Developer Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Mail size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@domain.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Password
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
                  className="w-full pl-10 pr-4 py-3 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              id="btn-login"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white font-semibold text-sm hover:from-[#6d28d9] hover:to-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-lg shadow-purple-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="spinner-dev" />
                  <span>Configuring workspace...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Initialize Workspace</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Registration Redirect */}
          <div className="mt-6 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-xs text-zinc-500">
              New to InterviewAI?{' '}
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Register developer credentials
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
