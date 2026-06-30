import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Cpu,
  ShieldCheck,
  Activity,
  ChevronRight,
  Play,
  ArrowRight,
  Brain,
  Video,
  Mic,
  Layers,
  Lock,
  Sparkles,
  Workflow,
  MicOff
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('proctoring');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [commandInput, setCommandInput] = useState('');

  // Gaze Tracking Sandbox Interactive States
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHoveredGazeCard, setIsHoveredGazeCard] = useState(false);
  const gazeCardRef = useRef(null);

  // Audio Testing Baseline States
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [audioLevels, setAudioLevels] = useState(new Array(18).fill(20));
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sourceRef = useRef(null);

  const handleGazeMouseMove = (e) => {
    if (!gazeCardRef.current) return;
    const rect = gazeCardRef.current.getBoundingClientRect();
    // Normalize coordinates relative to card center from -1 to 1
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x, y });
  };

  // Web Audio API Microphone Baseline Visualizer
  const startMicTest = async () => {
    if (isMicTesting) {
      stopMicTest();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // Small size for responsive bar nodes

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setIsMicTesting(true);
      updateFrequencyBars();
    } catch (err) {
      console.warn('Microphone permission not granted or missing, activating simulated audio baseline');
      setIsMicTesting(true);
      simulateFrequencyBars();
    }
  };

  const stopMicTest = () => {
    setIsMicTesting(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (sourceRef.current) {
      sourceRef.current.mediaStream.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setAudioLevels(new Array(18).fill(20));
  };

  const updateFrequencyBars = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    // Map frequency values to dynamic heights
    const levels = Array.from(dataArrayRef.current)
      .slice(0, 18)
      .map(val => Math.max(15, (val / 255) * 90));
    
    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(updateFrequencyBars);
  };

  // Elegant fallback sinus wave simulator for audio visualization
  const simulateFrequencyBars = () => {
    if (!isMicTesting) return;

    const time = Date.now() * 0.005;
    const levels = Array.from({ length: 18 }).map((_, i) => {
      const base = Math.sin(time + i * 0.4) * 35 + 50;
      const noise = Math.cos(time * 1.5 + i) * 15;
      return Math.max(15, base + noise);
    });

    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(simulateFrequencyBars);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Terminal commands handling
  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const cmd = commandInput.toLowerCase().trim();
    let response = '';

    if (cmd === 'help') {
      response = 'Payload choices: init, status, telemetry, clean';
    } else if (cmd === 'init') {
      response = 'Initializing session_id: a3b9-11ea-9c02... calibration baseline [OK]';
    } else if (cmd === 'status') {
      response = `Secure Link: OK | User: ${isAuthenticated ? 'Authenticated' : 'Guest'} | Proctoring: Active`;
    } else if (cmd === 'telemetry') {
      response = 'Integrity Score: 100% | Eye Vectors: CALIBRATED | Audio Decibels: -42dB';
    } else if (cmd === 'clean') {
      setTerminalLogs([]);
      setCommandInput('');
      return;
    } else {
      response = `Command unknown: "${cmd}". Type "help" for catalog.`;
    }

    setTerminalLogs(prev => [...prev, `$ ${commandInput}`, `> ${response}`]);
    setCommandInput('');
  };

  // Initial terminal logs output
  useEffect(() => {
    setTerminalLogs([
      'System: Mounting InterviewAI Core Sandbox...',
      'System: Tracking libraries loaded (MediaPipe, Web Audio API)',
      'System: Type "help" in the console below to list commands.',
    ]);
  }, [isAuthenticated]);

  const tabContent = {
    proctoring: {
      title: 'Real-time Computer Vision Proctoring',
      subtitle: 'MediaPipe Face Mesh Gaze Tracking',
      description: 'The proctoring engine monitors face position, gaze vectors, and window focus changes to generate a session integrity index. All processing is kept local to ensure speed.',
      metrics: [
        { label: 'Gaze Focus Rate', value: '98.4%' },
        { label: 'Latency Check', value: '14ms' },
        { label: 'Face Mesh Nodes', value: '468 points' },
      ],
      code: `// Gaze Vector Calibration
const faceMesh = new FaceMesh({ locateFile: ... });
faceMesh.onResults((results) => {
  const GazeVector = calculateGazeDirection(results.multiFaceLandmarks[0]);
  if (Math.abs(GazeVector.x) > GAZE_THRESHOLD) {
    dispatchFlag("GAZE_OFF_SCREEN", "high_severity");
  }
});`
    },
    speech: {
      title: 'Speech & Semantic Analytics',
      subtitle: 'Web Speech Synthesis & Rubric Parsers',
      description: 'Instant analysis of your vocal responses, tracking filler words ("um", "like", "so"), speaking velocity (WPM), and technical keyword coverage against structured rubrics.',
      metrics: [
        { label: 'Definition Match', value: '100%' },
        { label: 'Avg WPM Range', value: '130 - 150' },
        { label: 'Filler Word Penalty', value: '0.0' },
      ],
      code: `// Audio Speech Telemetry
const SpeechAnalyzer = {
  analyzeWPM: (words, duration) => (words / duration) * 60,
  detectFillers: (text) => text.match(/(like|uh|um|so|actually)/gi) || [],
  verifyRubric: (transcript, rubric) => {
    return rubric.concepts.filter(concept => transcript.includes(concept));
  }
};`
    },
    llm: {
      title: 'Adaptive Follow-up Pipeline',
      subtitle: 'Contextual Conversational Memory',
      description: 'Using Gemini LLM models, the simulator updates follow-up questions tailored dynamically to user-logged weak concepts rather than using standard static question pools.',
      metrics: [
        { label: 'Model Engine', value: 'Gemini 3.5' },
        { label: 'Context Windows', value: '32k tokens' },
        { label: 'Topic Alignment', value: 'Dynamic' },
      ],
      code: `// Adaptive LLM Prompt Assembly
const prompt = \`
  Analyze candidate response to "\${question}".
  Detected gaps: \${evaluation.missing_concepts.join(", ")}.
  Generate follow-up question digging deeper into these missing blocks.
\`;`
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030306] overflow-x-hidden w-full select-none" id="landing-page">
      {/* Background Matrix Grid */}
      <div className="absolute inset-0 cyber-grid-bg pointer-events-none z-0" />
      <div className="ambient-glow-purple -top-40 -right-20" />
      <div className="ambient-glow-blue top-1/3 -left-40" />
      <div className="ambient-glow-purple -bottom-40 right-20" />

      {/* HEADER / NAVIGATION BAR */}
      <header className="relative w-full h-20 px-6 lg:px-12 flex items-center justify-between border-b border-white/[0.04] bg-zinc-950/20 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-xl blur opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-950 border border-white/10 text-white">
              <Terminal size={18} className="text-purple-400" />
            </div>
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white font-heading">
            Interview<span className="text-cyber-gradient">AI</span>
          </span>
        </div>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#sandbox" className="hover:text-white transition-colors">Vector Playground</a>
          <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
        </nav>

        <div>
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            id="btn-nav-action"
            className="relative inline-flex items-center gap-2 py-2 px-5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] text-white text-xs font-bold font-mono transition-all cursor-pointer group"
          >
            <span>{isAuthenticated ? 'Enter Workspace' : 'Sign In'}</span>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 lg:pt-28 pb-12 flex flex-col items-center text-center space-y-8">
        
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono tracking-widest uppercase">
          <Sparkles size={11} className="text-purple-400" />
          Version 1.4 Stable Sandbox Active
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl font-heading leading-[1.1] select-none">
          <motion.span
            whileHover={{
              y: 0,
              rotate: 360,
              filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.35))'
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 18 }}
            className="inline-block cursor-pointer hover:text-lime-300"
          >
            The Next-Generation
          </motion.span>{' '}
          <motion.span
            whileHover={{
              scale: 1.05,
              filter: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.75))',
              textShadow: '0 0 8px rgba(168, 85, 247, 0.5)'
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            className="text-cyber-gradient inline-block cursor-pointer relative"
          >
            AI Proctoring
          </motion.span>{' '}
          <motion.span
            whileHover={{
              scale: 1.05,
              filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.75))',
              textShadow: '0 0 8px rgba(6, 182, 212, 0.5)'
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            className="text-cyan-gradient inline-block cursor-pointer relative"
          >
            Interview Sandbox
          </motion.span>
        </h1>

        {/* Subtitle */}
        <p className="text-zinc-400 text-sm md:text-base font-mono max-w-2xl leading-relaxed">
          Calibrate visual trackers, speak through adaptive mock rubrics, and inspect real-time integrity timelines in an environment built for developers.
        </p>

        {/* Interactive Shell command block placeholder */}
        <motion.div
          whileHover={{
            scale: 1.03,
            borderColor: 'rgba(139, 92, 246, 0.3)',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.12)'
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="bg-zinc-950/60 border border-white/5 rounded-lg py-2 px-4 text-xs text-purple-400 font-mono inline-block cursor-pointer transition-all duration-300"
        >
          <span className="text-zinc-600">npm init</span> interview-ai-sandbox <span className="text-cyan-400">--theme cyber-midnight</span>
        </motion.div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            id="hero-primary-action"
            className="w-full sm:w-auto relative inline-flex items-center justify-center gap-2.5 py-4 px-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all cursor-pointer group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Play size={12} className="fill-current text-white shrink-0" />
            <span>Launch Simulation Sandbox</span>
          </Link>
          
          <a
            href="#sandbox"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 py-4 px-8 rounded-xl bg-zinc-950/60 border border-white/5 hover:border-white/10 hover:bg-zinc-950 text-zinc-300 hover:text-white font-bold text-xs font-mono transition-all cursor-pointer"
          >
            <span>Interact with Vision Sensors</span>
          </a>
        </div>
      </section>

      {/* NEW UNIQUE & EYE CATCHING ELEMENTS SANDBOX SECTION */}
      <section id="sandbox" className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">Interactive Hardware Calibration</h2>
          <h3 className="text-3xl font-extrabold text-white font-heading">Test Vision Vectors & Voice Baselines</h3>
          <p className="text-zinc-500 text-xs font-mono">
            Hover over the head mesh or activate the microphone check to experience the local telemetry engine directly inside the browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Card 1: Gaze Tracker Face Mesh HUD Simulator */}
          <div
            ref={gazeCardRef}
            onMouseMove={handleGazeMouseMove}
            onMouseEnter={() => setIsHoveredGazeCard(true)}
            onMouseLeave={() => {
              setIsHoveredGazeCard(false);
              setMousePos({ x: 0, y: 0 });
            }}
            className="cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between h-[380px] group transition-all"
          >
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white font-heading">MediaPipe Gaze Vector HUD</h4>
                <p className="text-[10px] text-zinc-500 font-mono">Simulated face-mesh eye coordinate tracking</p>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                !isHoveredGazeCard ? 'bg-zinc-900 border-zinc-800 text-zinc-500' :
                Math.abs(mousePos.x) > 0.6 || Math.abs(mousePos.y) > 0.6 ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' :
                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {!isHoveredGazeCard ? 'SLEEP' :
                 Math.abs(mousePos.x) > 0.6 || Math.abs(mousePos.y) > 0.6 ? 'WARN: GAZE AWAY' : 'LOCK: STABLE'}
              </span>
            </div>

            {/* Central Graphic: Responsive Facial Vector Grid */}
            <div className="relative flex-1 flex items-center justify-center">
              {/* Outer calibration radar lines */}
              <div className="absolute w-44 h-44 rounded-full border border-white/[0.02] animate-ping" style={{ animationDuration: '6s' }} />
              <div className="absolute w-56 h-56 rounded-full border border-white/[0.01]" />

              {/* Gaze tracking line from center to cursor */}
              {isHoveredGazeCard && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <line
                    x1="50%"
                    y1="50%"
                    x2={`${50 + mousePos.x * 25}%`}
                    y2={`${50 + mousePos.y * 25}%`}
                    stroke="rgba(139, 92, 246, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={`${50 + mousePos.x * 25}%`}
                    cy={`${50 + mousePos.y * 25}%`}
                    r="4"
                    fill="#a78bfa"
                    className="animate-pulse"
                  />
                </svg>
              )}

              {/* Custom SVG facial mesh representation */}
              <svg width="120" height="150" viewBox="0 0 120 150" className="text-zinc-700 z-10">
                {/* Outer Head Frame */}
                <ellipse cx="60" cy="75" rx="45" ry="55" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M 60,20 Q 60,130 60,130" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                <path d="M 15,75 Q 60,75 105,75" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />

                {/* Left Eye Node */}
                <circle cx={`${42 + mousePos.x * 4}`} cy={`${65 + mousePos.y * 4}`} r="5" fill="none" stroke={isHoveredGazeCard ? "#8b5cf6" : "currentColor"} strokeWidth="1.5" />
                <circle cx={`${42 + mousePos.x * 6}`} cy={`${65 + mousePos.y * 6}`} r="1.5" fill={isHoveredGazeCard ? "#06b6d4" : "currentColor"} />

                {/* Right Eye Node */}
                <circle cx={`${78 + mousePos.x * 4}`} cy={`${65 + mousePos.y * 4}`} r="5" fill="none" stroke={isHoveredGazeCard ? "#8b5cf6" : "currentColor"} strokeWidth="1.5" />
                <circle cx={`${78 + mousePos.x * 6}`} cy={`${65 + mousePos.y * 6}`} r="1.5" fill={isHoveredGazeCard ? "#06b6d4" : "currentColor"} />

                {/* Nose mesh anchor */}
                <polygon points={`${60 + mousePos.x * 3},75 ${57 + mousePos.x * 2},90 ${63 + mousePos.x * 2},90`} fill="none" stroke="currentColor" strokeWidth="1" />

                {/* Mouth mesh coordinate points */}
                <path d={`M ${48 + mousePos.x * 2},105 Q ${60 + mousePos.x * 3},${112 + mousePos.y * 2} ${72 + mousePos.x * 2},105`} fill="none" stroke={isHoveredGazeCard ? "#8b5cf6" : "currentColor"} strokeWidth="1" />
              </svg>
            </div>

            {/* Matrix Data outputs */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/[0.04] pt-4 font-mono text-[9px] text-zinc-500">
              <div>
                <span>Eye Focus Coord:</span>
                <span className="text-zinc-300 block font-semibold">
                  X: {mousePos.x.toFixed(3)}, Y: {mousePos.y.toFixed(3)}
                </span>
              </div>
              <div className="text-right">
                <span>Mesh Tracking Status:</span>
                <span className={`block font-semibold ${isHoveredGazeCard ? 'text-purple-400' : 'text-zinc-500'}`}>
                  {isHoveredGazeCard ? 'TRACKING ACTIVE' : 'AWAITING HANDSHAKE'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Audio Frequency Decibel Visualizer */}
          <div className="cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between h-[380px] transition-all">
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white font-heading">Vocal Frequency Spectrum check</h4>
                <p className="text-[10px] text-zinc-500 font-mono">Microphone db input mapping visualizer</p>
              </div>
              <span className={`text-[9px] font-mono px-2.5 py-1 rounded-md border ${
                isMicTesting ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}>
                {isMicTesting ? 'SPEECH SENSOR ON' : 'SENSOR SLEEP'}
              </span>
            </div>

            {/* Visualizer active panel */}
            <div className="relative flex-1 flex flex-col items-center justify-center bg-zinc-950/40 rounded-xl border border-white/[0.02] p-6">
              
              {/* Dynamic waveform display bars */}
              <div className="flex items-end gap-1.5 h-28 justify-center w-full">
                {audioLevels.map((height, idx) => (
                  <div
                    key={idx}
                    className="w-2.5 rounded-t bg-gradient-to-t from-purple-600 via-purple-500 to-cyan-400 transition-all duration-75 relative"
                    style={{
                      height: `${height}%`,
                      boxShadow: isMicTesting ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'
                    }}
                  >
                    {/* Glowing caps */}
                    {isMicTesting && (
                      <div className="absolute -top-1 left-0 right-0 h-1 rounded-full bg-cyan-200" />
                    )}
                  </div>
                ))}
              </div>

              {/* Instruction banner */}
              <div className="mt-6 text-center">
                <button
                  onClick={startMicTest}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    isMicTesting
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                      : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 shadow-lg shadow-cyan-500/5'
                  }`}
                >
                  {isMicTesting ? (
                    <>
                      <MicOff size={13} />
                      <span>Release Audio Stream</span>
                    </>
                  ) : (
                    <>
                      <Mic size={13} />
                      <span>Test Speech Sensor Baseline</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Spectrum info text */}
            <div className="flex items-center justify-between border-t border-white/[0.04] pt-4 font-mono text-[9px] text-zinc-500">
              <span>Hertz band: 20Hz - 22kHz</span>
              <span>Buffer allocation: Web Audio Nodes</span>
            </div>

          </div>

        </div>
      </section>

      {/* INTERACTIVE TERMINAL SIMULATOR SECTION */}
      <section id="demo" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono">Telemetry Playground</h2>
          <h3 className="text-3xl font-extrabold text-white font-heading">Inspect Simulation Under the Hood</h3>
          <p className="text-zinc-500 text-xs font-mono">
            Click on each tab below to see how our proctoring algorithms, speech parsers, and neural pipelines handle evaluation data in real time.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* Controls Panel - 5 Columns */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            
            {/* Tabs List */}
            {Object.keys(tabContent).map((key) => (
              <div
                key={key}
                onClick={() => setActiveTab(key)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all text-left ${
                  activeTab === key
                    ? 'bg-purple-950/10 border-purple-500/80 shadow-md shadow-purple-500/5'
                    : 'bg-zinc-950/40 border-white/5 hover:border-white/10 hover:bg-zinc-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-white leading-none capitalize">
                    {key} Diagnostics
                  </h4>
                  <span className={`text-[8px] font-mono px-2 py-0.5 rounded ${
                    activeTab === key ? 'bg-purple-500/20 text-purple-300' : 'bg-zinc-900 text-zinc-500'
                  }`}>
                    Module
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed font-mono">
                  {tabContent[key].subtitle}
                </p>
              </div>
            ))}

            {/* Custom Interactive Console Input Widget */}
            <div className="cyber-card rounded-2xl p-5 border border-white/5 space-y-4">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">
                Interactive Commands Terminal
              </span>

              <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin">
                {terminalLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.startsWith('$') ? 'text-purple-400' :
                      log.startsWith('>') ? 'text-cyan-400' :
                      'text-zinc-500'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>

              <form onSubmit={handleCommandSubmit} className="relative">
                <input
                  type="text"
                  placeholder='Type "help" or "telemetry" here...'
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-xs font-mono text-white outline-none focus:border-purple-500/50"
                />
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors cursor-pointer"
                >
                  <ArrowRight size={12} />
                </button>
              </form>
            </div>

          </div>

          {/* Interactive Telemetry Box - 7 Columns */}
          <div className="col-span-12 lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="cyber-card rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
                <div className="absolute top-2 right-4 text-[9px] text-zinc-600 font-mono">SANDBOX_CONSOLE</div>

                <div className="space-y-6">
                  
                  {/* Tab Title Block */}
                  <div>
                    <h3 className="text-xl font-extrabold text-white font-heading mb-1">
                      {tabContent[activeTab].title}
                    </h3>
                    <span className="text-[10px] text-purple-400 font-mono tracking-wider uppercase block">
                      {tabContent[activeTab].subtitle}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                    {tabContent[activeTab].description}
                  </p>

                  {/* Metrics grid mock */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.04]">
                    {tabContent[activeTab].metrics.map((m, idx) => (
                      <div key={idx} className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl text-center">
                        <span className="text-[9px] text-zinc-500 font-mono uppercase block mb-1">{m.label}</span>
                        <span className="text-sm font-extrabold font-mono text-cyan-400">{m.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Code Snippet Box */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Engine Source Code</span>
                    <pre className="bg-zinc-950 border border-white/5 p-4 rounded-xl text-[10px] text-purple-300 font-mono leading-relaxed overflow-x-auto">
                      <code>{tabContent[activeTab].code}</code>
                    </pre>
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* CORE FEATURES BENTO GRID */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">Sandbox Specs</h2>
          <h3 className="text-3xl font-extrabold text-white font-heading">Designed for High-Fidelity Evaluations</h3>
          <p className="text-zinc-500 text-xs font-mono">
            A comprehensive suite of tools built directly on web APIs for proctoring checks and mock feedback.
          </p>
        </div>

        {/* Bento grid layout */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Card 1: Gaze Tracker */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-16 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Video size={18} />
            </div>
            <h4 className="font-bold text-sm text-white mb-2 font-heading">Computer Vision Trackers</h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Leverages MediaPipe to check gaze angle thresholds, verify face presence, and score eye contact integrity index values locally.
            </p>
          </div>

          {/* Card 2: Speech Analytics */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-16 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Mic size={18} />
            </div>
            <h4 className="font-bold text-sm text-white mb-2 font-heading">Vocal Pace & Clarity</h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Extracts audio buffer streams to measure speaking tempo (Words Per Minute), detect filler word events, and isolate long silent intervals.
            </p>
          </div>

          {/* Card 3: Adaptive Q&A */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-16 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Brain size={18} />
            </div>
            <h4 className="font-bold text-sm text-white mb-2 font-heading">Adaptive Follow-ups</h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Generates follow-up questions tailored dynamically to missing rubric blocks and conceptual weakness patterns from earlier responses.
            </p>
          </div>

          {/* Card 4: Integrity Engine (Double width) */}
          <div className="col-span-12 md:col-span-12 lg:col-span-8 cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-md">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck size={18} />
                </div>
                <h4 className="font-bold text-sm text-white font-heading">Secure Focus Safeguards</h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                  Generates warnings if the browser tab loses focus, if fullscreen mode is exited, or if copy-paste actions are attempted. These incidents are compiled directly into the integrity timeline.
                </p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 shrink-0 flex flex-col gap-2 font-mono text-[10px] w-full md:w-52">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                  <span className="text-zinc-500">Security Gate</span>
                  <span className="text-emerald-400 font-bold">LOCKED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Tab Blurs</span>
                  <span className="text-zinc-300">0 events</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Copy-Paste Logs</span>
                  <span className="text-zinc-300">Block Event</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Real-time Rubrics */}
          <div className="col-span-12 md:col-span-12 lg:col-span-4 cyber-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-16 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Layers size={18} />
            </div>
            <h4 className="font-bold text-sm text-white mb-2 font-heading">Rubric Criteria Grading</h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Breaks technical scoring down into distinct checks (Definition, Mechanism, Example, Edge Cases) to show exactly where your response has gaps.
            </p>
          </div>

        </div>
      </section>

      {/* VISUAL ARCHITECTURE FLOWCHART SECTION */}
      <section id="architecture" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono">Pipeline Core</h2>
          <h3 className="text-3xl font-extrabold text-white font-heading">Real-Time Data Architecture Flow</h3>
          <p className="text-zinc-500 text-xs font-mono">
            How candidate answers, vision vectors, and vocal frequencies map to our analytics system.
          </p>
        </div>

        {/* Architecture flowchart block */}
        <div className="cyber-card rounded-2xl p-8 border border-white/5 shadow-2xl relative overflow-hidden bg-zinc-950/20">
          <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            
            {/* Node 1: Candidate Input */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-900/60 border border-white/5 w-44 hover:border-purple-500/40 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <Mic size={16} />
              </div>
              <h5 className="text-xs font-bold text-white font-mono uppercase">Vocal Input</h5>
              <p className="text-[9px] text-zinc-500 font-mono mt-1">Web Audio Stream & Video mesh vectors</p>
            </div>

            {/* Path 1 */}
            <div className="hidden lg:flex flex-col items-center">
              <ChevronRight size={18} className="text-purple-500" />
              <span className="text-[8px] font-mono text-zinc-600 uppercase">Stream</span>
            </div>

            {/* Node 2: Proctoring & Speech Processing Engines */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-900/60 border border-white/5 w-48 hover:border-cyan-500/40 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                <Activity size={16} />
              </div>
              <h5 className="text-xs font-bold text-white font-mono uppercase">Local Engines</h5>
              <p className="text-[9px] text-zinc-500 font-mono mt-1">MediaPipe Mesh analysis + WPM vocal pace checker</p>
            </div>

            {/* Path 2 */}
            <div className="hidden lg:flex flex-col items-center">
              <ChevronRight size={18} className="text-purple-500" />
              <span className="text-[8px] font-mono text-zinc-600 uppercase">Payload</span>
            </div>

            {/* Node 3: LLM Evaluation */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-900/60 border border-white/5 w-48 hover:border-purple-500/40 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <Workflow size={16} />
              </div>
              <h5 className="text-xs font-bold text-white font-mono uppercase">Gemini Pipe</h5>
              <p className="text-[9px] text-zinc-500 font-mono mt-1">Structured rubric grading + adaptive next prompt</p>
            </div>

            {/* Path 3 */}
            <div className="hidden lg:flex flex-col items-center">
              <ChevronRight size={18} className="text-purple-500" />
              <span className="text-[8px] font-mono text-zinc-600 uppercase">Inject</span>
            </div>

            {/* Node 4: User Report DB */}
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-900/60 border border-white/5 w-44 hover:border-cyan-500/40 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                <Layers size={16} />
              </div>
              <h5 className="text-xs font-bold text-white font-mono uppercase">Integrity DB</h5>
              <p className="text-[9px] text-zinc-500 font-mono mt-1">Final behavior logs, score metrics and weak topics</p>
            </div>

          </div>
        </div>
      </section>

      {/* MOCK PRICING & SPECIFICATIONS TAB */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          {/* Platform stats */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">Sandbox Specs</h3>
            <h4 className="text-3xl font-extrabold text-white font-heading">High-performance client architecture</h4>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              We leverage browser features to run calculations locally. This drastically minimizes server latency overhead and guarantees privacy.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5">
                <span className="text-[9px] text-zinc-500 font-mono uppercase block mb-1">Gaze Processing</span>
                <span className="text-base font-extrabold font-mono text-white">&lt; 15ms latency</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5">
                <span className="text-[9px] text-zinc-500 font-mono uppercase block mb-1">Audio Sample Rate</span>
                <span className="text-base font-extrabold font-mono text-white">44.1 kHz raw</span>
              </div>
            </div>
          </div>

          {/* Prompt card action */}
          <div className="cyber-card rounded-2xl p-8 border border-white/5 relative overflow-hidden text-center flex flex-col items-center justify-center">
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-purple-500 to-transparent" />
            <h4 className="text-lg font-bold text-white mb-2 font-heading">Start Practicing Now</h4>
            <p className="text-xs text-zinc-500 font-mono max-w-xs mb-6 leading-relaxed">
              Initialize calibration to test your technical depth against adaptive ML follow-ups.
            </p>
            <Link
              to={isAuthenticated ? "/dashboard" : "/login"}
              id="cta-bottom"
              className="relative inline-flex items-center gap-2.5 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span>Configure Free Workspace</span>
              <ArrowRight size={12} />
            </Link>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 w-full py-12 px-6 border-t border-white/[0.04] bg-zinc-950/40 text-center font-mono text-[10px] text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <p>© {new Date().getFullYear()} InterviewAI Sandbox. All telemetry protected.</p>
          <div className="flex items-center gap-6">
            <span>API v1.4.2</span>
            <span>Local Processing OK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
