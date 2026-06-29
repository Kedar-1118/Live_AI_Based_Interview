import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play,
  Activity,
  Award,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
  Sparkles,
  Command,
  ListTodo,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { userAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated AI Assistant messages based on actual weak topics
  const [assistantMessage, setAssistantMessage] = useState('Welcome to your InterviewAI sandbox. Select a topic to begin mock training.');

  // Draggable tasks checklist
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Calibrate microphone baseline', completed: true },
    { id: 2, text: 'Practice 1 System Design session', completed: false },
    { id: 3, text: 'Review ML evaluation report', completed: false },
  ]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashRes, weakRes] = await Promise.all([
        userAPI.dashboard(),
        userAPI.weakTopics().catch(() => ({ data: [] })),
      ]);
      setDashboard(dashRes.data);
      const wt = weakRes.data || [];
      setWeakTopics(wt);

      if (wt.length > 0) {
        setAssistantMessage(`Based on your recent sessions, you have some gaps in ${wt[0].topic}. I recommend starting a Medium difficulty practice to rebuild your score.`);
      } else {
        setAssistantMessage("Ready to begin. Your baseline microphone and gaze calibration will start automatically in your first session.");
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const classes = {
      easy: 'badge-dev-easy',
      medium: 'badge-dev-medium',
      hard: 'badge-dev-hard',
    };
    return `badge-dev ${classes[difficulty] || 'badge-dev-medium'}`;
  };

  const getStatusColor = (status) => {
    const classes = {
      active: 'badge-dev-active',
      completed: 'badge-dev-completed',
    };
    return `badge-dev ${classes[status] || ''}`;
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-zinc-500';
    if (score <= 3) return 'text-red-400';
    if (score <= 5) return 'text-amber-400';
    if (score <= 7) return 'text-blue-400';
    return 'text-emerald-400';
  };

  const getScoreLabel = (score) => {
    if (score === null || score === undefined) return 'N/A';
    if (score <= 3) return 'Critical';
    if (score <= 5) return 'Weak';
    if (score <= 7) return 'Moderate';
    return 'Strong';
  };

  // Toggle tasks check
  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner-dev" style={{ width: 32, height: 32 }} />
          <p className="text-zinc-400 text-sm tracking-wide">Syncing developer workspace...</p>
        </div>
      </div>
    );
  }

  // Process data for AreaChart telemetry
  const chartData = (dashboard?.recent_sessions || [])
    .filter(s => s.avg_score !== null)
    .reverse()
    .map((s, idx) => ({
      name: `S-${idx + 1}`,
      score: Math.round(s.avg_score * 10) / 10,
      topic: s.topic,
    }));

  return (
    <div className="relative min-h-screen bg-[#030303] overflow-hidden">
      {/* Background orbs */}
      <div className="glow-bg-orb glow-purple" />
      <div className="glow-bg-orb glow-blue" />

      <div className="workspace-container md:pl-24 lg:pl-[240px] transition-all" id="dashboard-page">
        <main className="workspace-content">
          
          {/* Hero Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-2">
                Workspace / <span className="text-gradient font-bold">{user?.name || 'Developer'}</span>
              </h1>
              <p className="text-zinc-400 text-sm max-w-lg">
                Proctored sandbox telemetry, adaptive mock scores, and active weakness trackers.
              </p>
            </div>
            <Link
              to="/session/setup"
              id="btn-new-interview"
              className="btn-dev btn-dev-primary flex items-center gap-2"
            >
              <Play size={14} className="fill-current text-white" />
              <span>Launch Simulator</span>
            </Link>
          </div>

          {/* Bento Grid */}
          <div className="bento-grid">
            
            {/* CARD 1: Pinned Session Workspace (Recent Sessions table) - Large Bento 8 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 xl:col-span-8 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-[#a78bfa]" />
                  <h3 className="font-bold text-sm tracking-tight text-white">Active Telemetry / Recent Sessions</h3>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold bg-white/5 px-2 py-0.5 rounded">
                  Live DB Connection
                </span>
              </div>

              {dashboard?.recent_sessions?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-zinc-500 text-[10px] uppercase font-semibold tracking-wider">
                        <th className="pb-3 pl-2">Session Topic</th>
                        <th className="pb-3">Difficulty</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Progress</th>
                        <th className="pb-3 text-right pr-2">Mock Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {dashboard.recent_sessions.map((session) => (
                        <tr
                          key={session.id}
                          className="group hover:bg-white/[0.02] transition-colors rounded-lg"
                        >
                          <td className="py-3 pl-2">
                            <Link
                              to={`/session/${session.id}`}
                              className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors block"
                            >
                              {session.topic}
                            </Link>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(session.started_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={getDifficultyColor(session.difficulty)}>
                              {session.difficulty}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={getStatusColor(session.status)}>
                              {session.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-20 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] h-full"
                                  style={{
                                    width: `${(session.questions_answered / session.total_questions) * 100}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-zinc-400 font-mono">
                                {session.questions_answered}/{session.total_questions}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-right pr-2">
                            {session.avg_score !== null ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className={`text-sm font-bold font-mono ${getScoreColor(session.avg_score)}`}>
                                  {session.avg_score.toFixed(1)}
                                </span>
                                <span className="text-zinc-600 text-xs">/10</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 text-xs font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4">
                    <BookOpen size={20} className="text-zinc-500" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">No Practice Sessions Active</h4>
                  <p className="text-xs text-zinc-500 max-w-xs mb-4">
                    Start mock training inside the simulator room to calibrate eye contact vectors.
                  </p>
                  <Link to="/session/setup" id="btn-first-interview" className="btn-dev btn-dev-primary text-xs">
                    Configure Session
                  </Link>
                </div>
              )}
            </motion.div>

            {/* CARD 2: Stats Grid & Telemetry Plot - Medium Bento 4 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 md:col-span-6 xl:col-span-4 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-400" />
                  <h3 className="font-bold text-sm tracking-tight text-white">Score Analytics Timeline</h3>
                </div>
                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                  Adaptive Score
                </span>
              </div>

              {chartData.length > 0 ? (
                <div className="w-full h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} domain={[0, 10]} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#18181b',
                          borderColor: 'rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelClassName="text-zinc-500 font-semibold"
                        itemStyle={{ color: '#a78bfa' }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#scoreGlow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-500 text-xs">
                  Awaiting telemetry metrics...
                </div>
              )}

              {/* Mini Numerical Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/[0.04]">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Total Sessions</span>
                  <div className="text-xl font-bold text-white mt-0.5 font-mono">
                    {dashboard?.total_sessions || 0}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Average Grade</span>
                  <div className="text-xl font-bold mt-0.5 font-mono text-[#a78bfa]">
                    {dashboard?.avg_score ? `${dashboard.avg_score.toFixed(1)}/10` : '—'}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 3: AI Assistant Sandbox Pilot - 4 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 md:col-span-6 xl:col-span-4 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg flex flex-col justify-between cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-[#a855f7]" />
                <h3 className="font-bold text-sm tracking-tight text-white font-mono">AI Sandbox Pilot</h3>
              </div>
              <div className="flex-1 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl mb-4 text-xs leading-relaxed text-zinc-300">
                "{assistantMessage}"
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <Cpu size={12} className="text-purple-400" />
                <span>Model: Gemini 3.5 Flash</span>
              </div>
            </motion.div>

            {/* CARD 4: Weak Topics heatmap - 4 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 md:col-span-6 xl:col-span-4 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-[#a78bfa]" />
                  <h3 className="font-bold text-sm tracking-tight text-white">Topics Requiring Practice</h3>
                </div>
                <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-semibold uppercase">
                  Heatmap
                </span>
              </div>

              {weakTopics.length > 0 ? (
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                  {weakTopics.slice(0, 4).map((wt) => (
                    <div
                      key={wt.id}
                      className="p-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.03] flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-semibold text-zinc-200 block truncate">{wt.topic}</span>
                        <span className="text-[10px] text-zinc-500 block truncate">{wt.subtopic || 'General Concepts'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-bold font-mono ${getScoreColor(wt.avg_score)}`}>
                          {wt.avg_score?.toFixed(1) || '—'}
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          {wt.occurrence} occurrence{wt.occurrence > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-500 text-xs text-center px-4">
                  No weak topics found yet. Keep training to log metrics.
                </div>
              )}
            </motion.div>

            {/* CARD 5: Draggable Sandbox Checklist - 4 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 md:col-span-6 xl:col-span-4 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg flex flex-col justify-between cursor-grab active:cursor-grabbing"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ListTodo size={18} className="text-[#a78bfa]" />
                  <h3 className="font-bold text-sm tracking-tight text-white">Developer Sandbox Tasks</h3>
                </div>
                <div className="space-y-3">
                  {tasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => toggleTask(t.id)}
                      className="flex items-center gap-3 cursor-pointer select-none group"
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        t.completed ? 'bg-purple-600 border-purple-500 text-white' : 'border-zinc-700 group-hover:border-zinc-500'
                      }`}>
                        {t.completed && (
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-4 block">
                Interactive Checkboxes
              </span>
            </motion.div>

            {/* CARD 6: Recent Files (Simulated Docs) - 4 Columns */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.05}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.12)' }}
              className="col-span-12 md:col-span-6 xl:col-span-4 dev-glass rounded-2xl p-6 border border-white/5 shadow-lg cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-[#a78bfa]" />
                  <h3 className="font-bold text-sm tracking-tight text-white">Recent Artifacts</h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <FileText size={14} className="text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-mono font-medium">integrity_timeline.log</span>
                  </div>
                  <span className="text-[9px] text-zinc-500">2KB</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={14} className="text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-mono font-medium">speech_performance.csv</span>
                  </div>
                  <span className="text-[9px] text-zinc-500">14KB</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <FileText size={14} className="text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-mono font-medium">calibration_vectors.json</span>
                  </div>
                  <span className="text-[9px] text-zinc-500">1KB</span>
                </div>
              </div>
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
