import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Cpu, Database, Network, Terminal, Settings, ChevronRight, Play } from 'lucide-react';
import useSessionStore from '../store/sessionStore';

const TOPICS = [
  { id: 'Machine Learning', icon: Brain, label: 'Machine Learning', desc: 'Neural nets, optimization, regression, SVMs' },
  { id: 'System Design', icon: Cpu, label: 'System Design', desc: 'Scalability, microservices, load balancing, caching' },
  { id: 'DSA', icon: Database, label: 'DSA', desc: 'Arrays, graphs, trees, dynamic programming' },
  { id: 'OS', icon: Terminal, label: 'Operating Systems', desc: 'Processes, memory, virtualization, scheduling' },
  { id: 'Networking', icon: Network, label: 'Networking', desc: 'TCP/IP, HTTP, routing, DNS, load balancers' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', description: 'Fundamental concepts & definitions' },
  { id: 'medium', label: 'Medium', description: 'Applied architectural knowledge' },
  { id: 'hard', label: 'Hard', description: 'Expert-level debugging & edge cases' },
];

const DURATIONS = [
  { minutes: 15, label: '15 Min', questions: 5 },
  { minutes: 30, label: '30 Min', questions: 10 },
  { minutes: 45, label: '45 Min', questions: 15 },
];

export default function SessionSetupPage() {
  const [topic, setTopic] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(DURATIONS[1]);
  const { startSession, isLoading, error } = useSessionStore();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!topic) return;
    const sessionId = await startSession(
      topic,
      difficulty,
      duration.minutes,
      duration.questions,
    );
    if (sessionId) {
      navigate(`/session/${sessionId}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030306] overflow-x-hidden w-full">
      <div className="workspace-container md:pl-24 lg:pl-[260px] p-6 lg:p-10 relative z-10">
        <main className="workspace-content max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="pb-6 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] text-purple-400 font-mono tracking-widest uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 dot-blink" />
              Configure System
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-2">
              Compile / <span className="text-cyber-gradient">Simulator Session</span>
            </h1>
            <p className="text-zinc-400 text-xs font-mono">
              Adjust telemetry parameters and pick your target domain to initialize calibration.
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Step 1: Select Topic */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="cyber-card rounded-2xl p-6 border border-white/5 shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2.5 font-mono">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-400 font-mono text-[10px] border border-purple-500/20">01</span>
                Target Interview Domain
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TOPICS.map((t) => {
                  const TopicIcon = t.icon;
                  const isSelected = topic === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      id={`topic-${t.id.toLowerCase().replace(' ', '-')}`}
                      className={`p-4 rounded-xl border cursor-pointer text-left transition-all ${
                        isSelected
                          ? 'bg-purple-950/15 border-purple-500/80 shadow-lg shadow-purple-500/5'
                          : 'bg-zinc-950/60 border-white/5 hover:border-white/10 hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-lg shrink-0 border transition-colors ${
                          isSelected ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-zinc-900 text-zinc-400 border-white/5'
                        }`}>
                          <TopicIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white leading-tight mb-1">{t.label}</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal truncate">{t.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Step 2: Select Difficulty */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="cyber-card rounded-2xl p-6 border border-white/5 shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2.5 font-mono">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-cyan-500/10 text-cyan-400 font-mono text-[10px] border border-cyan-500/20">02</span>
                Adaptive Complexity Level
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DIFFICULTIES.map((d) => {
                  const isSelected = difficulty === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      id={`difficulty-${d.id}`}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-950/15 border-cyan-500/80 shadow-lg shadow-cyan-500/5'
                          : 'bg-zinc-950/60 border-white/5 hover:border-white/10 hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${
                          d.id === 'easy' ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : d.id === 'medium' ? 'bg-amber-500 shadow-md shadow-amber-500/20' : 'bg-red-500 shadow-md shadow-red-500/20'
                        }`} />
                        <h4 className="text-sm font-bold text-white capitalize">{d.label}</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-normal">{d.description}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Step 3: Select Duration */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="cyber-card rounded-2xl p-6 border border-white/5 shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2.5 font-mono">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-400 font-mono text-[10px] border border-purple-500/20">03</span>
                Session Duration & Questions
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DURATIONS.map((d) => {
                  const isSelected = duration.minutes === d.minutes;
                  return (
                    <div
                      key={d.minutes}
                      onClick={() => setDuration(d)}
                      id={`duration-${d.minutes}`}
                      className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-950/15 border-purple-500/80 shadow-lg shadow-purple-500/5'
                          : 'bg-zinc-950/60 border-white/5 hover:border-white/10 hover:bg-zinc-950'
                      }`}
                    >
                      <h4 className="text-base font-extrabold text-white mb-1">{d.label}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">{d.questions} Questions telemetry</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Trigger Button Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="flex flex-col items-end gap-3 pt-4"
            >
              {!topic && (
                <p className="text-[11px] font-mono text-zinc-500">
                  💡 Select a target interview domain block above to initialize session compilation.
                </p>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs w-full max-w-md text-right font-mono">
                  {error}
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={!topic || isLoading}
                id="btn-start-interview"
                className="relative inline-flex items-center gap-2.5 py-4 px-8 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-purple-500/20 transition-all overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border border-white/30 border-t-white animate-spin shrink-0" />
                    <span className="font-mono">Compiling telemetry environments...</span>
                  </>
                ) : (
                  <>
                    <Play size={12} className="fill-current text-white shrink-0" />
                    <span>Initialize Calibration</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
