import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, UserPlus, AlertTriangle, X, Terminal } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    const success = await register(email, password, name);
    if (success) {
      navigate('/dashboard');
    }
  };

  const displayError = localError || error;

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
        className="w-full max-w-[440px] z-10"
      >
        {/* Logo/Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] shadow-xl shadow-purple-500/20 mb-4">
            <Terminal size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Create Account</h1>
          <p className="text-sm text-zinc-400">Join top-tier developers practicing interviews with AI</p>
        </div>

        {/* Register Form Container */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.3 }}
          className="dev-glass rounded-2xl p-8 border border-white/5 shadow-2xl relative overflow-hidden"
        >
          <form onSubmit={handleSubmit} id="register-form" className="space-y-4">
            
            {/* Error Messages */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                id="register-error"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Registration Failed</span>
                  <span>{displayError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { clearError(); setLocalError(null); }}
                  className="text-red-400 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}

            {/* Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <User size={16} />
                </span>
                <input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Email Address
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
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Lock size={16} />
                </span>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-4 focus:ring-purple-500/10 text-sm transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              id="btn-register"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 mt-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white font-semibold text-sm hover:from-[#6d28d9] hover:to-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-lg shadow-purple-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="spinner-dev" />
                  <span>Registering user account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Credentials</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Login Redirect */}
          <div className="mt-6 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-xs text-zinc-500">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Sign in to workspace
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
