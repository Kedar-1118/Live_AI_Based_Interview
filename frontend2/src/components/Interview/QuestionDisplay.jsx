import { motion } from 'framer-motion';
import { Terminal, Cpu } from 'lucide-react';

export default function QuestionDisplay({ question, questionIndex, totalQuestions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.5 }}
      id="question-display"
      className="dev-glass rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden"
    >
      {/* Decorative top grid */}
      <div className="absolute top-0 right-0 p-3 text-zinc-800 pointer-events-none select-none">
        <Cpu size={36} className="opacity-10" />
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-4">
        <span className="text-[10px] font-bold font-mono bg-purple-500/10 text-[#a78bfa] border border-[#8b5cf6]/20 px-2 py-0.5 rounded uppercase tracking-wider">
          Mock Prompt #{questionIndex}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          State: Active prompt
        </span>
      </div>

      <h2 className="text-lg lg:text-xl font-bold text-white leading-relaxed tracking-tight select-text">
        {question}
      </h2>
    </motion.div>
  );
}
