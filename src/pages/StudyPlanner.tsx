import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  uploadSyllabusPDF, 
  deleteSyllabusPDF, 
  saveStudyPlansToDb, 
  loadStudyPlansFromDb,
  type UploadedPDF 
} from "../lib/supabase";

// ============ TYPES ============
interface Subject {
  id: string;
  name: string;
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  color: string;
  syllabusPdf?: UploadedPDF; // Optional PDF attachment
}

interface Task {
  id: string;
  subjectId: string;
  topic: string;
  duration: number; // minutes
  type: "learn" | "revision";
  completed: boolean;
  skipped: boolean;
  date: string;
}

interface StudyPlan {
  id: string;
  name: string;
  subjects: Subject[];
  tasks: Task[];
  examDate: string;
  dailyStudyTime: number;
  generatedAt: string;
  streak: number;
  lastStudyDate: string;
  totalCompleted: number;
}

interface PlansStorage {
  plans: StudyPlan[];
  activePlanId: string | null;
}

interface SetupData {
  planName: string;
  subjects: Subject[];
  examDate: string;
  dailyStudyTime: number;
}

// ============ CONSTANTS ============
const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"
];

const STORAGE_KEY = "studyPlanner_v2";

const DIFFICULTY_MULTIPLIER = { easy: 0.7, medium: 1, hard: 1.5 };

// ============ UTILITY FUNCTIONS ============
const generateId = () => Math.random().toString(36).substring(2, 9);

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const getDaysBetween = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
};

const addDays = (date: string, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

// ============ STORAGE HOOKS ============
const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue];
};

// ============ PLAN GENERATION ENGINE ============
const generateStudyPlan = (setup: SetupData): Task[] => {
  const { subjects, examDate, dailyStudyTime } = setup;
  const today = formatDate(new Date());
  const totalDays = getDaysBetween(today, examDate);
  
  if (totalDays <= 0 || subjects.length === 0) return [];

  const tasks: Task[] = [];
  
  // For subjects with PDF but no topics, create a placeholder topic
  const subjectsWithTopics = subjects.map(s => ({
    ...s,
    topics: s.topics.length > 0 
      ? s.topics 
      : s.syllabusPdf 
        ? [`Study ${s.name} (see PDF syllabus)`] 
        : []
  }));

  // Filter out subjects that have no topics and no PDF
  const validSubjects = subjectsWithTopics.filter(s => s.topics.length > 0);
  
  if (validSubjects.length === 0) return [];

  // Calculate total weight based on difficulty and topics
  const subjectWeights = validSubjects.map(s => ({
    ...s,
    weight: Math.max(1, s.topics.length) * DIFFICULTY_MULTIPLIER[s.difficulty]
  }));
  const totalWeight = subjectWeights.reduce((sum, s) => sum + s.weight, 0);
  
  // Distribute time per subject
  const subjectTimeAllocation = subjectWeights.map(s => ({
    ...s,
    totalMinutes: Math.floor((s.weight / totalWeight) * dailyStudyTime * totalDays)
  }));

  // Calculate revision phases (last 30% of time)
  const revisionStartDay = Math.floor(totalDays * 0.7);
  
  // Generate tasks for each day
  for (let day = 0; day < totalDays; day++) {
    const currentDate = addDays(today, day);
    const isRevisionPhase = day >= revisionStartDay;
    let remainingMinutes = dailyStudyTime;
    
    // Shuffle subjects for variety
    const shuffled = [...subjectTimeAllocation].sort(() => Math.random() - 0.5);
    
    for (const subject of shuffled) {
      if (remainingMinutes <= 0) break;
      
      const topicsCount = subject.topics.length;
      if (topicsCount === 0) continue;
      
      // Determine task duration based on difficulty
      const baseDuration = subject.difficulty === "hard" ? 45 : 
                          subject.difficulty === "medium" ? 35 : 25;
      const duration = Math.min(baseDuration, remainingMinutes);
      
      if (duration < 15) continue; // Skip if too little time
      
      // Pick topic (cycle through topics based on day)
      const topicIndex = day % topicsCount;
      const topic = subject.topics[topicIndex];
      
      tasks.push({
        id: generateId(),
        subjectId: subject.id,
        topic,
        duration,
        type: isRevisionPhase ? "revision" : "learn",
        completed: false,
        skipped: false,
        date: currentDate
      });
      
      remainingMinutes -= duration;
    }
  }
  
  return tasks;
};

// ============ UI COMPONENTS ============

// 3D Card Component
const Card3D: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}> = ({ children, className = "", hover = true, onClick }) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotateY((x - centerX) / 20);
    setRotateX(-(y - centerY) / 20);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className={`relative ${className}`}
      style={{
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
      animate={{
        rotateX: rotateX,
        rotateY: rotateY,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

// Glass Card
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  depth?: number;
}> = ({ children, className = "", depth = 1 }) => {
  const shadows = [
    "shadow-lg",
    "shadow-xl shadow-black/20",
    "shadow-2xl shadow-black/30"
  ];
  
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-white/10 to-white/5
        backdrop-blur-xl border border-white/10
        ${shadows[Math.min(depth, 2)]}
        ${className}
      `}
      style={{
        transform: `translateZ(${depth * 10}px)`,
      }}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};

// Button with depth
const Button3D: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, variant = "primary", disabled = false, className = "" }) => {
  const variants = {
    primary: "bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white",
    secondary: "bg-gradient-to-b from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white",
    success: "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white",
    danger: "bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white",
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-6 py-3 rounded-xl font-semibold
        ${variants[variant]}
        shadow-lg shadow-black/20
        border-t border-white/20
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.98, y: disabled ? 0 : 2 }}
    >
      {children}
    </motion.button>
  );
};

// Streak Badge
const StreakBadge: React.FC<{ streak: number }> = ({ streak }) => {
  const isActive = streak > 0;
  
  return (
    <motion.div
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-full
        ${isActive 
          ? "bg-gradient-to-r from-orange-500 to-amber-500" 
          : "bg-slate-700"
        }
        shadow-lg
      `}
      animate={isActive ? {
        boxShadow: [
          "0 0 20px rgba(249, 115, 22, 0.3)",
          "0 0 40px rgba(249, 115, 22, 0.5)",
          "0 0 20px rgba(249, 115, 22, 0.3)"
        ]
      } : {}}
      transition={{ repeat: Infinity, duration: 2 }}
    >
      <motion.span
        className="text-2xl"
        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        🔥
      </motion.span>
      <span className="font-bold text-white">{streak} day streak</span>
    </motion.div>
  );
};

// Progress Ring
const ProgressRing: React.FC<{ progress: number; size?: number; color?: string }> = ({ 
  progress, 
  size = 80,
  color = "#6366f1"
}) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
            filter: `drop-shadow(0 0 6px ${color})`
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-white">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

// Task Card
const TaskCard: React.FC<{
  task: Task;
  subject: Subject | undefined;
  onComplete: () => void;
  onSkip: () => void;
}> = ({ task, subject, onComplete, onSkip }) => {
  const [showConfetti, setShowConfetti] = useState(false);

  const handleComplete = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1000);
    onComplete();
  };

  if (task.completed || task.skipped) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0.6, scale: 0.98 }}
        className="relative"
      >
        <GlassCard className={`p-5 ${task.completed ? "border-emerald-500/30" : "border-slate-500/30"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: subject?.color || "#666" }}
              />
              <div>
                <p className="font-medium text-white/60 line-through">{task.topic}</p>
                <p className="text-sm text-white/40">{subject?.name}</p>
              </div>
            </div>
            <span className={`text-sm font-medium ${task.completed ? "text-emerald-400" : "text-slate-400"}`}>
              {task.completed ? "✓ Done" : "Skipped"}
            </span>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <Card3D className="w-full">
      <GlassCard className="p-5" depth={2}>
        {showConfetti && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6"][i % 4],
                  left: "50%",
                  top: "50%"
                }}
                initial={{ x: 0, y: 0, scale: 1 }}
                animate={{
                  x: Math.cos(i * 30 * Math.PI / 180) * 100,
                  y: Math.sin(i * 30 * Math.PI / 180) * 100,
                  scale: 0,
                  opacity: 0
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
        
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${subject?.color}20` }}
              whileHover={{ rotate: [0, -10, 10, 0] }}
            >
              {task.type === "revision" ? "📖" : "📚"}
            </motion.div>
            <div>
              <h3 className="font-semibold text-white text-lg">{task.topic}</h3>
              <p className="text-sm text-white/60">{subject?.name}</p>
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${subject?.color}30`,
              color: subject?.color
            }}
          >
            {task.type === "revision" ? "Revision" : "Learn"}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/60">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{task.duration} min</span>
          </div>
          
          <div className="flex gap-2">
            <Button3D variant="secondary" onClick={onSkip} className="!px-4 !py-2 text-sm">
              Skip
            </Button3D>
            <Button3D variant="success" onClick={handleComplete} className="!px-4 !py-2 text-sm">
              Complete ✓
            </Button3D>
          </div>
        </div>
      </GlassCard>
    </Card3D>
  );
};

// Subject Input Card
const SubjectInput: React.FC<{
  subject: Subject;
  onChange: (subject: Subject) => void;
  onRemove: () => void;
}> = ({ subject, onChange, onRemove }) => {
  const [topicInput, setTopicInput] = useState("");
  const [pdfUploadStatus, setPdfUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [pdfError, setPdfError] = useState<string>("");

  const addTopic = () => {
    if (topicInput.trim()) {
      onChange({ ...subject, topics: [...subject.topics, topicInput.trim()] });
      setTopicInput("");
    }
  };

  const removeTopic = (index: number) => {
    onChange({ ...subject, topics: subject.topics.filter((_, i) => i !== index) });
  };

  // PDF Upload Handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setPdfError("");
    setPdfUploadStatus("uploading");

    // Client-side validation
    if (file.type !== "application/pdf") {
      setPdfError("Only PDF files are allowed");
      setPdfUploadStatus("error");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setPdfError("File size must be less than 10MB");
      setPdfUploadStatus("error");
      return;
    }

    try {
      const result = await uploadSyllabusPDF(file, subject.id);

      if (result.success && result.data) {
        onChange({ ...subject, syllabusPdf: result.data });
        setPdfUploadStatus("success");
      } else {
        setPdfError(result.error || "Upload failed");
        setPdfUploadStatus("error");
      }
    } catch {
      setPdfError("An unexpected error occurred");
      setPdfUploadStatus("error");
    }

    // Reset file input
    e.target.value = "";
  };

  // Remove PDF Handler
  const handleRemovePdf = async () => {
    if (!subject.syllabusPdf) return;

    const confirmed = window.confirm("Are you sure you want to remove this PDF?");
    if (!confirmed) return;

    // Delete from storage
    await deleteSyllabusPDF(subject.syllabusPdf.path);

    // Remove from subject
    onChange({ ...subject, syllabusPdf: undefined });
    setPdfUploadStatus("idle");
    setPdfError("");
  };

  // Open PDF in new tab
  const openPdf = () => {
    if (subject.syllabusPdf?.url) {
      window.open(subject.syllabusPdf.url, "_blank");
    }
  };

  return (
    <Card3D>
      <GlassCard className="p-5" depth={1}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full cursor-pointer"
              style={{ backgroundColor: subject.color }}
            />
            <input
              type="text"
              value={subject.name}
              onChange={(e) => onChange({ ...subject, name: e.target.value })}
              placeholder="Subject name"
              className="bg-transparent text-white font-semibold text-lg outline-none border-b border-transparent focus:border-white/30 transition-colors"
            />
          </div>
          <button
            onClick={onRemove}
            className="text-rose-400 hover:text-rose-300 transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Difficulty */}
        <div className="mb-4">
          <label className="text-sm text-white/60 mb-2 block">Difficulty</label>
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => onChange({ ...subject, difficulty: diff })}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all
                  ${subject.difficulty === diff
                    ? diff === "easy" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                    : diff === "medium" ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                    : "bg-slate-700/50 text-white/60 border border-transparent hover:bg-slate-600/50"
                  }
                `}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="mb-4">
          <label className="text-sm text-white/60 mb-2 block">Topics</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTopic()}
              placeholder="Add topic and press Enter"
              className="flex-1 bg-slate-700/50 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
            <Button3D onClick={addTopic} className="!px-4 !py-2">+</Button3D>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {subject.topics.map((topic, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                >
                  {topic}
                  <button
                    onClick={() => removeTopic(i)}
                    className="hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* PDF Upload Section */}
        <div className="pt-4 border-t border-white/10">
          <label className="text-sm text-white/60 mb-3 block flex items-center gap-2">
            <span className="text-lg">📄</span>
            OR Upload Syllabus PDF
          </label>

          {/* Show uploaded PDF or upload button */}
          {subject.syllabusPdf ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate text-sm">{subject.syllabusPdf.name}</p>
                <p className="text-emerald-400 text-xs">✓ Uploaded successfully</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPdf}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </button>
                <button
                  onClick={handleRemovePdf}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                  title="Remove PDF"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {/* Upload Input */}
              <label className="relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  disabled={pdfUploadStatus === "uploading"}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                {pdfUploadStatus === "uploading" ? (
                  <>
                    <motion.div
                      className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    />
                    <span className="text-indigo-400 text-sm font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-white/40 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-white/60 group-hover:text-white/80 text-sm transition-colors">
                      Click to upload PDF <span className="text-white/40">(max 10MB)</span>
                    </span>
                  </>
                )}
              </label>

              {/* Error Message */}
              <AnimatePresence>
                {pdfUploadStatus === "error" && pdfError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-rose-400 text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {pdfError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </GlassCard>
    </Card3D>
  );
};

// ============ MAIN COMPONENT ============
const StudyPlanner: React.FC = () => {
  const [plansStorage, setPlansStorageInternal] = useLocalStorage<PlansStorage>(STORAGE_KEY, { plans: [], activePlanId: null });
  const [view, setView] = useState<"setup" | "dashboard" | "plans">("setup");
  const [setupData, setSetupData] = useState<SetupData>({
    planName: "",
    subjects: [],
    examDate: "",
    dailyStudyTime: 120
  });
  const [error, setError] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "offline">("synced");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapper to save to both localStorage and Supabase
  const setPlansStorage = useCallback((value: PlansStorage | ((prev: PlansStorage) => PlansStorage)) => {
    setPlansStorageInternal(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      
      // Debounced save to database
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      setSyncStatus("syncing");
      saveTimeoutRef.current = setTimeout(async () => {
        const success = await saveStudyPlansToDb(newValue);
        setSyncStatus(success ? "synced" : "error");
      }, 1000); // Debounce by 1 second
      
      return newValue;
    });
  }, [setPlansStorageInternal]);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadFromDb = async () => {
      setSyncStatus("syncing");
      const dbData = await loadStudyPlansFromDb();
      
      if (dbData) {
        // Use database data (source of truth)
        setPlansStorageInternal(dbData as PlansStorage);
        setSyncStatus("synced");
        
        // Set view based on loaded data
        if (dbData.activePlanId) {
          setView("dashboard");
        } else if (dbData.plans.length > 0) {
          setView("plans");
        } else {
          setView("setup");
        }
      } else {
        // No database data - check localStorage (for migration)
        if (plansStorage.activePlanId) {
          setView("dashboard");
          // Migrate localStorage data to database
          saveStudyPlansToDb(plansStorage);
        } else if (plansStorage.plans.length > 0) {
          setView("plans");
          saveStudyPlansToDb(plansStorage);
        } else {
          setView("setup");
        }
        setSyncStatus("synced");
      }
      
      setIsLoaded(true);
    };

    loadFromDb();
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get active plan
  const plan = useMemo(() => {
    if (!plansStorage.activePlanId) return null;
    return plansStorage.plans.find(p => p.id === plansStorage.activePlanId) || null;
  }, [plansStorage]);

  // Update plan helper
  const updateActivePlan = useCallback((updater: (plan: StudyPlan) => StudyPlan) => {
    if (!plansStorage.activePlanId) return;
    setPlansStorage(prev => ({
      ...prev,
      plans: prev.plans.map(p => 
        p.id === prev.activePlanId ? updater(p) : p
      )
    }));
  }, [plansStorage.activePlanId, setPlansStorage]);

  // Update streak check (runs after plan is available)
  useEffect(() => {
    if (plan && isLoaded) {
      const today = formatDate(new Date());
      const yesterday = addDays(today, -1);
      
      if (plan.lastStudyDate && plan.lastStudyDate !== today && plan.lastStudyDate !== yesterday) {
        // Streak broken
        updateActivePlan(p => ({ ...p, streak: 0 }));
      }
    }
  }, [plan, isLoaded]);

  // Check reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const addSubject = () => {
    const newSubject: Subject = {
      id: generateId(),
      name: "",
      topics: [],
      difficulty: "medium",
      color: COLORS[setupData.subjects.length % COLORS.length]
    };
    setSetupData({ ...setupData, subjects: [...setupData.subjects, newSubject] });
  };

  const updateSubject = (id: string, updated: Subject) => {
    setSetupData({
      ...setupData,
      subjects: setupData.subjects.map(s => s.id === id ? updated : s)
    });
  };

  const removeSubject = (id: string) => {
    setSetupData({
      ...setupData,
      subjects: setupData.subjects.filter(s => s.id !== id)
    });
  };

  const validateAndGenerate = () => {
    setError("");
    
    // Validation
    if (setupData.subjects.length === 0) {
      setError("Please add at least one subject");
      return;
    }
    
    for (const subject of setupData.subjects) {
      if (!subject.name.trim()) {
        setError("All subjects must have a name");
        return;
      }
      // Allow either topics OR a PDF (at least one must be present)
      if (subject.topics.length === 0 && !subject.syllabusPdf) {
        setError(`Add at least one topic or upload a syllabus PDF for "${subject.name}"`);
        return;
      }
    }
    
    if (!setupData.examDate) {
      setError("Please select your exam date");
      return;
    }
    
    const today = formatDate(new Date());
    if (setupData.examDate <= today) {
      setError("Exam date must be in the future");
      return;
    }
    
    if (setupData.dailyStudyTime < 30) {
      setError("Daily study time must be at least 30 minutes");
      return;
    }

    // Generate plan
    const tasks = generateStudyPlan(setupData);
    
    if (tasks.length === 0) {
      setError("Could not generate a valid study plan. Please check your inputs.");
      return;
    }

    const newPlan: StudyPlan = {
      id: generateId(),
      name: setupData.planName || `Study Plan ${plansStorage.plans.length + 1}`,
      subjects: setupData.subjects,
      tasks,
      examDate: setupData.examDate,
      dailyStudyTime: setupData.dailyStudyTime,
      generatedAt: formatDate(new Date()),
      streak: 0,
      lastStudyDate: "",
      totalCompleted: 0
    };

    setPlansStorage(prev => ({
      plans: [...prev.plans, newPlan],
      activePlanId: newPlan.id
    }));
    setSetupData({ planName: "", subjects: [], examDate: "", dailyStudyTime: 120 });
    setView("dashboard");
  };

  const completeTask = (taskId: string) => {
    if (!plan) return;
    
    const today = formatDate(new Date());
    const wasStreakUpdatedToday = plan.lastStudyDate === today;
    
    updateActivePlan(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: true } : t),
      streak: wasStreakUpdatedToday ? p.streak : p.streak + 1,
      lastStudyDate: today,
      totalCompleted: p.totalCompleted + 1
    }));
  };

  const skipTask = (taskId: string) => {
    if (!plan) return;
    
    // Skip task and redistribute to future
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) return;

    const today = formatDate(new Date());
    const futureDates = [...new Set(plan.tasks
      .filter(t => t.date > today && !t.completed && !t.skipped)
      .map(t => t.date)
    )].sort();

    let updatedTasks = plan.tasks.map(t => 
      t.id === taskId ? { ...t, skipped: true } : t
    );

    // Add redistributed task to a future date if available
    if (futureDates.length > 0) {
      const redistributeDate = futureDates[0];
      const newTask: Task = {
        ...task,
        id: generateId(),
        date: redistributeDate,
        skipped: false
      };
      updatedTasks = [...updatedTasks, newTask];
    }

    updateActivePlan(p => ({ ...p, tasks: updatedTasks }));
  };

  const deletePlan = (planId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this plan?");
    if (!confirmed) return;

    setPlansStorage(prev => {
      const newPlans = prev.plans.filter(p => p.id !== planId);
      const newActivePlanId = prev.activePlanId === planId 
        ? (newPlans.length > 0 ? newPlans[0].id : null)
        : prev.activePlanId;
      return { plans: newPlans, activePlanId: newActivePlanId };
    });

    if (plansStorage.plans.length <= 1) {
      setView("setup");
    }
  };

  const switchToPlan = (planId: string) => {
    setPlansStorage(prev => ({ ...prev, activePlanId: planId }));
    setView("dashboard");
  };

  const createNewPlan = () => {
    setSetupData({ planName: "", subjects: [], examDate: "", dailyStudyTime: 120 });
    setView("setup");
  };

  const goToPlansView = () => {
    if (plansStorage.plans.length > 0) {
      setView("plans");
    } else {
      setView("setup");
    }
  };

  // Calculate stats
  const todaysTasks = useMemo(() => {
    if (!plan) return [];
    const today = formatDate(new Date());
    return plan.tasks.filter(t => t.date === today);
  }, [plan]);

  const todaysProgress = useMemo(() => {
    if (todaysTasks.length === 0) return 0;
    const completed = todaysTasks.filter(t => t.completed).length;
    return (completed / todaysTasks.length) * 100;
  }, [todaysTasks]);

  const overallProgress = useMemo(() => {
    if (!plan || plan.tasks.length === 0) return 0;
    const completed = plan.tasks.filter(t => t.completed).length;
    return (completed / plan.tasks.length) * 100;
  }, [plan]);

  const daysUntilExam = useMemo(() => {
    if (!plan) return 0;
    return getDaysBetween(formatDate(new Date()), plan.examDate);
  }, [plan]);

  const getSubjectById = (id: string) => plan?.subjects.find(s => s.id === id);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Show loading screen while initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="text-white/60">Loading Study Planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Portfolio
              </a>
              {/* Sync Status Indicator */}
              <div className="flex items-center gap-2 text-sm">
                {syncStatus === "syncing" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 text-yellow-400"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⟳
                    </motion.div>
                    <span className="hidden sm:inline">Syncing...</span>
                  </motion.div>
                )}
                {syncStatus === "synced" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 text-green-400"
                  >
                    <span>☁️</span>
                    <span className="hidden sm:inline">Synced</span>
                  </motion.div>
                )}
                {syncStatus === "error" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 text-red-400"
                  >
                    <span>⚠️</span>
                    <span className="hidden sm:inline">Sync failed</span>
                  </motion.div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plansStorage.plans.length > 0 && view !== "plans" && (
                <Button3D variant="secondary" onClick={goToPlansView} className="!px-4 !py-2 text-sm">
                  📚 All Plans ({plansStorage.plans.length})
                </Button3D>
              )}
              {view === "dashboard" && (
                <Button3D variant="primary" onClick={createNewPlan} className="!px-4 !py-2 text-sm">
                  + New Plan
                </Button3D>
              )}
            </div>
          </div>
          
          <div className="text-center">
            <motion.h1
              className="text-4xl md:text-5xl font-bold text-white mb-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              📚 AI Study Planner
            </motion.h1>
            <p className="text-white/60 text-lg">
              {view === "setup" 
                ? "Create your personalized study plan" 
                : view === "plans"
                ? "Select a plan or create a new one"
                : plan?.name || "Track your progress and stay on track"}
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* PLANS LIST VIEW */}
          {view === "plans" && (
            <motion.div
              key="plans"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -100 }}
              className="space-y-6"
            >
              <motion.div variants={itemVariants} className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                  <span className="text-2xl">📋</span> Your Study Plans
                </h2>
                <Button3D onClick={createNewPlan}>+ Create New Plan</Button3D>
              </motion.div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plansStorage.plans.map((p) => {
                  const progress = p.tasks.length > 0 
                    ? (p.tasks.filter(t => t.completed).length / p.tasks.length) * 100 
                    : 0;
                  const daysLeft = getDaysBetween(formatDate(new Date()), p.examDate);
                  const isActive = p.id === plansStorage.activePlanId;

                  return (
                    <motion.div key={p.id} variants={itemVariants}>
                      <Card3D>
                        <GlassCard 
                          className={`p-5 cursor-pointer transition-all ${isActive ? 'ring-2 ring-indigo-500' : ''}`} 
                          depth={2}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-white text-lg">{p.name}</h3>
                              <p className="text-white/40 text-sm">
                                Created {p.generatedAt}
                              </p>
                            </div>
                            {isActive && (
                              <span className="px-2 py-1 rounded-full text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                Active
                              </span>
                            )}
                          </div>

                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">Subjects</span>
                              <span className="text-white">{p.subjects.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">Days Left</span>
                              <span className={`${daysLeft <= 7 ? 'text-rose-400' : 'text-white'}`}>
                                {daysLeft > 0 ? daysLeft : 'Expired'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-white/60">Progress</span>
                                <span className="text-white">{Math.round(progress)}%</span>
                              </div>
                              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button3D 
                              variant="primary" 
                              onClick={() => switchToPlan(p.id)}
                              className="flex-1 !px-3 !py-2 text-sm"
                            >
                              {isActive ? 'View' : 'Open'}
                            </Button3D>
                            <Button3D 
                              variant="danger" 
                              onClick={() => deletePlan(p.id)}
                              className="!px-3 !py-2 text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button3D>
                          </div>
                        </GlassCard>
                      </Card3D>
                    </motion.div>
                  );
                })}

                {plansStorage.plans.length === 0 && (
                  <motion.div variants={itemVariants} className="col-span-full">
                    <Card3D hover={false}>
                      <GlassCard className="p-12 text-center">
                        <p className="text-white/60 text-lg mb-4">
                          You don't have any study plans yet
                        </p>
                        <Button3D onClick={createNewPlan}>Create Your First Plan</Button3D>
                      </GlassCard>
                    </Card3D>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* SETUP VIEW */}
          {view === "setup" && (
            <motion.div
              key="setup"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -100 }}
              className="space-y-6"
            >
              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-rose-500/20 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-xl"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Study Settings */}
              <motion.div variants={itemVariants}>
                <Card3D hover={false}>
                  <GlassCard className="p-6" depth={2}>
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                      <span className="text-2xl">⚙️</span> Study Settings
                    </h2>
                    
                    {/* Plan Name */}
                    <div className="mb-6">
                      <label className="text-sm text-white/60 mb-2 block">Plan Name</label>
                      <input
                        type="text"
                        value={setupData.planName}
                        onChange={(e) => setSetupData({ ...setupData, planName: e.target.value })}
                        placeholder="e.g., Final Exams 2026, UPSC Prep, Board Exams..."
                        className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-white/60 mb-2 block">Exam Date</label>
                        <input
                          type="date"
                          value={setupData.examDate}
                          onChange={(e) => setSetupData({ ...setupData, examDate: e.target.value })}
                          min={addDays(formatDate(new Date()), 1)}
                          className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-white/60 mb-2 block">
                          Daily Study Time: {setupData.dailyStudyTime} minutes
                        </label>
                        <input
                          type="range"
                          min="30"
                          max="480"
                          step="15"
                          value={setupData.dailyStudyTime}
                          onChange={(e) => setSetupData({ ...setupData, dailyStudyTime: parseInt(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-white/40 mt-1">
                          <span>30 min</span>
                          <span>8 hours</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Card3D>
              </motion.div>

              {/* Subjects */}
              <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span className="text-2xl">📖</span> Subjects
                  </h2>
                  <Button3D onClick={addSubject}>+ Add Subject</Button3D>
                </div>
                
                <div className="space-y-4">
                  <AnimatePresence>
                    {setupData.subjects.map((subject) => (
                      <motion.div
                        key={subject.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <SubjectInput
                          subject={subject}
                          onChange={(updated) => updateSubject(subject.id, updated)}
                          onRemove={() => removeSubject(subject.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {setupData.subjects.length === 0 && (
                    <Card3D hover={false}>
                      <GlassCard className="p-12 text-center">
                        <p className="text-white/60 text-lg">
                          Click "Add Subject" to get started
                        </p>
                      </GlassCard>
                    </Card3D>
                  )}
                </div>
              </motion.div>

              {/* Generate Button */}
              <motion.div variants={itemVariants} className="text-center pt-4">
                <Button3D
                  onClick={validateAndGenerate}
                  disabled={setupData.subjects.length === 0}
                  className="text-lg !px-12 !py-4"
                >
                  🚀 Generate Study Plan
                </Button3D>
              </motion.div>
            </motion.div>
          )}

          {/* DASHBOARD VIEW */}
          {view === "dashboard" && plan && (
            <motion.div
              key="dashboard"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: 100 }}
              className="space-y-6"
            >
              {/* Stats Row */}
              <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card3D>
                  <GlassCard className="p-5 text-center" depth={1}>
                    <ProgressRing progress={todaysProgress} color="#22c55e" />
                    <p className="text-white/60 mt-3 text-sm">Today's Progress</p>
                  </GlassCard>
                </Card3D>
                
                <Card3D>
                  <GlassCard className="p-5 text-center" depth={1}>
                    <ProgressRing progress={overallProgress} color="#6366f1" />
                    <p className="text-white/60 mt-3 text-sm">Overall Progress</p>
                  </GlassCard>
                </Card3D>
                
                <Card3D>
                  <GlassCard className="p-5 text-center" depth={1}>
                    <div className="text-4xl font-bold text-white">{daysUntilExam}</div>
                    <p className="text-white/60 mt-2 text-sm">Days Until Exam</p>
                  </GlassCard>
                </Card3D>
                
                <Card3D>
                  <GlassCard className="p-5 flex items-center justify-center" depth={1}>
                    <StreakBadge streak={plan.streak} />
                  </GlassCard>
                </Card3D>
              </motion.div>

              {/* Today's Tasks */}
              <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Today's Tasks
                </h2>
                
                <div className="space-y-4">
                  <AnimatePresence>
                    {todaysTasks.length > 0 ? (
                      todaysTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          layout
                        >
                          <TaskCard
                            task={task}
                            subject={getSubjectById(task.subjectId)}
                            onComplete={() => completeTask(task.id)}
                            onSkip={() => skipTask(task.id)}
                          />
                        </motion.div>
                      ))
                    ) : (
                      <Card3D hover={false}>
                        <GlassCard className="p-12 text-center">
                          <p className="text-white/60 text-lg">
                            🎉 No tasks for today! Enjoy your break.
                          </p>
                        </GlassCard>
                      </Card3D>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Subject Progress */}
              <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">📊</span> Subject Progress
                </h2>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plan.subjects.map((subject) => {
                    const subjectTasks = plan.tasks.filter(t => t.subjectId === subject.id);
                    const completed = subjectTasks.filter(t => t.completed).length;
                    const progress = subjectTasks.length > 0 ? (completed / subjectTasks.length) * 100 : 0;
                    
                    return (
                      <Card3D key={subject.id}>
                        <GlassCard className="p-5" depth={1}>
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: subject.color }}
                            />
                            <h3 className="font-semibold text-white">{subject.name}</h3>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: subject.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                            />
                          </div>
                          <p className="text-white/60 text-sm mt-2">
                            {completed}/{subjectTasks.length} tasks completed
                          </p>
                        </GlassCard>
                      </Card3D>
                    );
                  })}
                </div>
              </motion.div>

              {/* Syllabus PDFs Section */}
              {plan.subjects.some(s => s.syllabusPdf) && (
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">📄</span> Syllabus Documents
                  </h2>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plan.subjects
                      .filter(subject => subject.syllabusPdf)
                      .map((subject) => (
                        <Card3D key={subject.id}>
                          <GlassCard className="p-5 group" depth={2}>
                            {/* 3D Floating PDF Icon */}
                            <motion.div
                              className="relative mb-4"
                              whileHover={{ scale: 1.05 }}
                              transition={{ type: "spring", stiffness: 300 }}
                            >
                              <div 
                                className="w-full h-32 rounded-xl flex items-center justify-center relative overflow-hidden"
                                style={{ 
                                  background: `linear-gradient(135deg, ${subject.color}20 0%, ${subject.color}10 100%)`,
                                  boxShadow: `0 10px 40px ${subject.color}20`
                                }}
                              >
                                {/* Decorative elements */}
                                <div className="absolute inset-0 opacity-30">
                                  <div className="absolute top-2 left-2 w-8 h-1 bg-white/20 rounded" />
                                  <div className="absolute top-5 left-2 w-12 h-1 bg-white/10 rounded" />
                                  <div className="absolute top-8 left-2 w-10 h-1 bg-white/10 rounded" />
                                  <div className="absolute bottom-2 right-2 w-6 h-1 bg-white/10 rounded" />
                                </div>
                                
                                {/* Main PDF Icon */}
                                <motion.div
                                  className="relative z-10"
                                  animate={{ 
                                    y: [0, -5, 0],
                                    rotateY: [0, 5, 0, -5, 0]
                                  }}
                                  transition={{ 
                                    repeat: Infinity, 
                                    duration: 4,
                                    ease: "easeInOut"
                                  }}
                                  style={{ transformStyle: "preserve-3d" }}
                                >
                                  <div 
                                    className="w-16 h-20 rounded-lg flex items-center justify-center shadow-2xl"
                                    style={{ 
                                      background: `linear-gradient(145deg, ${subject.color} 0%, ${subject.color}cc 100%)`,
                                      boxShadow: `0 15px 35px ${subject.color}40, 0 5px 15px rgba(0,0,0,0.3)`
                                    }}
                                  >
                                    <span className="text-white font-bold text-xs">PDF</span>
                                  </div>
                                  {/* 3D Shadow effect */}
                                  <div 
                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full blur-md opacity-50"
                                    style={{ backgroundColor: subject.color }}
                                  />
                                </motion.div>
                                
                                {/* Glow effect on hover */}
                                <motion.div
                                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  style={{
                                    background: `radial-gradient(circle at center, ${subject.color}30 0%, transparent 70%)`
                                  }}
                                />
                              </div>
                            </motion.div>
                            
                            {/* Subject Info */}
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: subject.color }}
                              />
                              <h3 className="font-semibold text-white truncate">{subject.name}</h3>
                            </div>
                            
                            {/* PDF Name */}
                            <p className="text-white/60 text-sm truncate mb-4" title={subject.syllabusPdf?.name}>
                              {subject.syllabusPdf?.name}
                            </p>
                            
                            {/* Open PDF Button */}
                            <motion.button
                              onClick={() => window.open(subject.syllabusPdf?.url, '_blank')}
                              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
                              style={{ 
                                backgroundColor: `${subject.color}20`,
                                color: subject.color,
                                border: `1px solid ${subject.color}30`
                              }}
                              whileHover={{ 
                                scale: 1.02,
                                backgroundColor: `${subject.color}30`
                              }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Open Syllabus
                            </motion.button>
                          </GlassCard>
                        </Card3D>
                      ))}
                  </div>
                </motion.div>
              )}

              {/* Upcoming Tasks Preview */}
              <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">📅</span> Coming Up
                </h2>
                
                <Card3D hover={false}>
                  <GlassCard className="p-5" depth={1}>
                    <div className="space-y-3">
                      {(() => {
                        const today = formatDate(new Date());
                        const upcoming = plan.tasks
                          .filter(t => t.date > today && !t.completed && !t.skipped)
                          .slice(0, 5);
                        
                        if (upcoming.length === 0) {
                          return (
                            <p className="text-white/60 text-center py-4">
                              No upcoming tasks
                            </p>
                          );
                        }
                        
                        return upcoming.map((task) => {
                          const subject = getSubjectById(task.subjectId);
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: subject?.color }}
                                />
                                <span className="text-white">{task.topic}</span>
                              </div>
                              <span className="text-white/40 text-sm">{task.date}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </GlassCard>
                </Card3D>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StudyPlanner;
