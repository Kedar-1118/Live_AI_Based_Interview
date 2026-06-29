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
    <div className="relative min-h-screen bg-[#030303] overflow-hidden">
      {/* Background orbs */}
      <div className="glow-bg-orb glow-purple" />
      <div className="glow-bg-orb glow-blue" />

      <div className="workspace-container md:pl-24 lg:pl-[240px]">
        <main className="workspace-content max-w-4xl">
          
          {/* Header */}
          <div className="mb-10 text-left">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-2">
              Configure / <span className="text-gradient">Mock Sandbox</span>
            </h1>
            <p className="text-zinc-400 text-sm">
              Adjust telemetry parameters and pick your target domain to initialize calibration.
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Step 1: Select Topic */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="dev-glass rounded-2xl p-6 border border-white/5 shadow-lg"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">1</span>
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
                          ? 'bg-[#8b5cf6]/5 border-[#8b5cf6] shadow-lg shadow-purple-500/5'
                          : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-lg shrink-0 ${
                          isSelected ? 'bg-[#8b5cf6]/20 text-[#a78bfa]' : 'bg-white/5 text-zinc-400'
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
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="dev-glass rounded-2xl p-6 border border-white/5 shadow-lg"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">2</span>
                Adaptive Complexity
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
                          ? 'bg-[#8b5cf6]/5 border-[#8b5cf6] shadow-lg shadow-purple-500/5'
                          : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${
                          d.id === 'easy' ? 'bg-emerald-500' : d.id === 'medium' ? 'bg-amber-500' : 'bg-red-500'
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
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="dev-glass rounded-2xl p-6 border border-white/5 shadow-lg"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">3</span>
                Session Duration Limits
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
                          ? 'bg-[#8b5cf6]/5 border-[#8b5cf6] shadow-lg shadow-purple-500/5'
                          : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      <h4 className="text-base font-bold text-white mb-1">{d.label}</h4>
                      <p className="text-xs text-zinc-500 font-mono">{d.questions} Questions</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Trigger Button Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex flex-col items-end gap-3"
            >
              {!topic && (
                <p className="text-xs text-zinc-500">
                  💡 Select a target interview domain block above to initialize session compilation.
                </p>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs w-full max-w-md text-right">
                  {error}
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={!topic || isLoading}
                id="btn-start-interview"
                className="btn-dev btn-dev-primary py-3.5 px-8 rounded-xl font-bold flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={!topic ? { transform: 'none', boxShadow: 'none' } : {}}
              >
                {isLoading ? (
                  <>
                    <div className="spinner-dev" />
                    <span>Compiling telemetry environments...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-current text-white" />
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
