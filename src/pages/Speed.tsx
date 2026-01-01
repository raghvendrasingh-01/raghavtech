import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard3DCanvas, MiniEarthCanvas } from "../components/canvas";

// ============ TYPES ============
interface CharStats {
  attempts: number;
  errors: number;
  lastPracticed: number;
}

interface LessonState {
  activeChars: string[];
  charStats: Record<string, CharStats>;
  totalSessions: number;
  totalCharsTyped: number;
  totalCorrect: number;
  bestWpm: number;
  currentStreak: number;
  lastSessionDate: string;
}

interface SessionStats {
  wpm: number;
  accuracy: number;
  charsTyped: number;
  errors: number;
  weakChars: string[];
}

// ============ CONSTANTS ============
const STORAGE_KEY = "typingPractice_v1";

// Character progression - ordered by learning difficulty
const CHAR_PROGRESSION = [
  // Home row first
  "a", "s", "d", "f", "j", "k", "l", ";",
  // Top row
  "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
  // Bottom row
  "z", "x", "c", "v", "b", "n", "m", ",", ".",
  // Numbers
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
];

const INITIAL_CHARS = ["a", "s", "d", "f", "j", "k", "l"];
const ACCURACY_THRESHOLD = 0.85; // 85% accuracy to unlock new char
const MIN_ATTEMPTS_TO_UNLOCK = 20;
const SESSION_LENGTH = 60; // seconds

// ============ STORAGE FUNCTIONS ============
const loadState = (): LessonState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load state:", e);
  }
  
  // Default state
  const initialStats: Record<string, CharStats> = {};
  INITIAL_CHARS.forEach(char => {
    initialStats[char] = { attempts: 0, errors: 0, lastPracticed: Date.now() };
  });
  
  return {
    activeChars: [...INITIAL_CHARS],
    charStats: initialStats,
    totalSessions: 0,
    totalCharsTyped: 0,
    totalCorrect: 0,
    bestWpm: 0,
    currentStreak: 0,
    lastSessionDate: "",
  };
};

const saveState = (state: LessonState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
};

// ============ LESSON GENERATOR ============
const generateLesson = (state: LessonState, length: number = 60): string => {
  const { activeChars, charStats } = state;
  const words: string[] = [];
  
  // Calculate weights based on error rate (more errors = higher weight)
  const charWeights: Record<string, number> = {};
  let totalWeight = 0;
  
  activeChars.forEach(char => {
    const stats = charStats[char] || { attempts: 0, errors: 0 };
    const accuracy = stats.attempts > 0 ? 1 - (stats.errors / stats.attempts) : 0.5;
    // Inverse accuracy for weight (lower accuracy = higher weight)
    const weight = Math.max(0.2, 1.5 - accuracy);
    charWeights[char] = weight;
    totalWeight += weight;
  });
  
  // Generate words using weighted random selection
  const selectChar = (seed: number): string => {
    let threshold = (seed % 1000) / 1000 * totalWeight;
    for (const char of activeChars) {
      threshold -= charWeights[char];
      if (threshold <= 0) return char;
    }
    return activeChars[0];
  };
  
  let charCount = 0;
  let seed = Date.now();
  
  while (charCount < length) {
    // Generate word of 3-7 characters
    const wordLength = 3 + (seed % 5);
    let word = "";
    
    for (let i = 0; i < wordLength && charCount + word.length < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff; // LCG for determinism
      word += selectChar(seed);
    }
    
    words.push(word);
    charCount += word.length + 1; // +1 for space
  }
  
  return words.join(" ");
};

// ============ ADAPTIVE ALGORITHM ============
const checkForUnlock = (state: LessonState): string | null => {
  const { activeChars, charStats } = state;
  
  // Check if all active chars meet threshold
  let allMeetThreshold = true;
  
  for (const char of activeChars) {
    const stats = charStats[char];
    if (!stats || stats.attempts < MIN_ATTEMPTS_TO_UNLOCK) {
      allMeetThreshold = false;
      break;
    }
    const accuracy = 1 - (stats.errors / stats.attempts);
    if (accuracy < ACCURACY_THRESHOLD) {
      allMeetThreshold = false;
      break;
    }
  }
  
  if (allMeetThreshold) {
    // Find next char to unlock
    for (const char of CHAR_PROGRESSION) {
      if (!activeChars.includes(char)) {
        return char;
      }
    }
  }
  
  return null;
};

const getWeakChars = (charStats: Record<string, CharStats>, activeChars: string[]): string[] => {
  return activeChars
    .filter(char => {
      const stats = charStats[char];
      if (!stats || stats.attempts < 5) return false;
      const accuracy = 1 - (stats.errors / stats.attempts);
      return accuracy < ACCURACY_THRESHOLD;
    })
    .sort((a, b) => {
      const aAcc = charStats[a] ? 1 - (charStats[a].errors / charStats[a].attempts) : 1;
      const bAcc = charStats[b] ? 1 - (charStats[b].errors / charStats[b].attempts) : 1;
      return aAcc - bAcc;
    })
    .slice(0, 5);
};

// ============ UI COMPONENTS ============

// Glass Card with 3D effect
const Card3D: React.FC<{
  children: React.ReactNode;
  className?: string;
  depth?: number;
}> = ({ children, className = "", depth = 1 }) => {
  return (
    <motion.div
      className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-white/10 to-white/5
        backdrop-blur-xl border border-white/10
        ${depth === 1 ? "shadow-lg" : depth === 2 ? "shadow-xl" : "shadow-2xl"}
        ${className}
      `}
      style={{
        transform: `perspective(1000px) translateZ(${depth * 5}px)`,
        transformStyle: "preserve-3d",
      }}
      whileHover={{
        transform: `perspective(1000px) translateZ(${depth * 8}px) translateY(-2px)`,
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
};

// Stat Card
const StatCard: React.FC<{
  value: string | number;
  label: string;
  color: string;
}> = ({ value, label, color }) => (
  <Card3D className="p-4 text-center min-w-[80px]" depth={1}>
    <motion.span
      className={`block text-2xl md:text-3xl font-bold ${color}`}
      key={value}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      {value}
    </motion.span>
    <span className="text-xs text-white/60 uppercase tracking-wide">{label}</span>
  </Card3D>
);

// Character Tile
const CharTile: React.FC<{
  char: string;
  accuracy: number;
  isActive: boolean;
}> = ({ char, accuracy, isActive }) => {
  const bgColor = accuracy >= 0.9 ? "bg-emerald-500/30" :
                  accuracy >= 0.7 ? "bg-amber-500/30" :
                  accuracy >= 0 ? "bg-rose-500/30" : "bg-slate-700/50";
  
  return (
    <motion.div
      className={`
        w-10 h-10 rounded-lg flex items-center justify-center
        font-mono text-lg font-semibold
        border transition-all duration-200
        ${isActive ? "border-indigo-500 text-white" : "border-white/10 text-white/60"}
        ${bgColor}
      `}
      whileHover={{ scale: 1.05, y: -2 }}
      style={{
        transform: "perspective(500px) translateZ(0)",
        boxShadow: isActive ? "0 4px 20px rgba(99, 102, 241, 0.3)" : "none"
      }}
    >
      {char.toUpperCase()}
    </motion.div>
  );
};

// Progress Ring
const ProgressRing: React.FC<{ progress: number; size?: number }> = ({ progress, size = 60 }) => {
  const strokeWidth = 4;
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
          className="text-indigo-500"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5 }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============
const Speed: React.FC = () => {
  const [lessonState, setLessonState] = useState<LessonState>(loadState);
  const [currentText, setCurrentText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(SESSION_LENGTH);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [pressedKey, setPressedKey] = useState("");
  const [newCharUnlocked, setNewCharUnlocked] = useState<string | null>(null);
  const [view, setView] = useState<"practice" | "progress">("practice");
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionErrorsRef = useRef<Record<string, number>>({});
  const sessionAttemptsRef = useRef<Record<string, number>>({});

  // Generate lesson text
  useEffect(() => {
    setCurrentText(generateLesson(lessonState));
  }, [lessonState.activeChars]);

  // Auto-focus on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  // Handle key visualization
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKey(e.key);
      
      // Auto-focus the input when user starts typing (printable character)
      if (!isFinished && e.key.length === 1 && inputRef.current) {
        inputRef.current.focus();
      }
    };
    const handleKeyUp = () => {
      setPressedKey("");
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isFinished]);

  // Timer
  useEffect(() => {
    if (isStarted && !isFinished && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isFinished]);

  // Calculate real-time stats
  const liveStats = useMemo(() => {
    const timeElapsed = isStarted ? (SESSION_LENGTH - timeLeft) / 60 : 0;
    let correct = 0;
    let errors = 0;
    
    for (let i = 0; i < typedText.length; i++) {
      if (i < currentText.length) {
        if (typedText[i] === currentText[i]) {
          correct++;
        } else {
          errors++;
        }
      }
    }
    
    const wpm = timeElapsed > 0 ? Math.round((correct / 5) / timeElapsed) : 0;
    const accuracy = typedText.length > 0 ? Math.round((correct / typedText.length) * 100) : 100;
    
    return { wpm, accuracy, correct, errors };
  }, [typedText, currentText, timeLeft, isStarted]);

  const endSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsFinished(true);
    
    // Calculate final stats
    const weakChars = getWeakChars(
      { ...lessonState.charStats, ...Object.fromEntries(
        Object.entries(sessionAttemptsRef.current).map(([char, attempts]) => [
          char,
          {
            attempts: (lessonState.charStats[char]?.attempts || 0) + attempts,
            errors: (lessonState.charStats[char]?.errors || 0) + (sessionErrorsRef.current[char] || 0),
            lastPracticed: Date.now()
          }
        ])
      )},
      lessonState.activeChars
    );
    
    setSessionStats({
      wpm: liveStats.wpm,
      accuracy: liveStats.accuracy,
      charsTyped: typedText.length,
      errors: liveStats.errors,
      weakChars
    });
    
    // Update lesson state
    const newCharStats = { ...lessonState.charStats };
    Object.entries(sessionAttemptsRef.current).forEach(([char, attempts]) => {
      if (!newCharStats[char]) {
        newCharStats[char] = { attempts: 0, errors: 0, lastPracticed: Date.now() };
      }
      newCharStats[char].attempts += attempts;
      newCharStats[char].errors += sessionErrorsRef.current[char] || 0;
      newCharStats[char].lastPracticed = Date.now();
    });
    
    const today = new Date().toISOString().split("T")[0];
    const newStreak = lessonState.lastSessionDate === today ? 
      lessonState.currentStreak : 
      lessonState.currentStreak + 1;
    
    const newState: LessonState = {
      ...lessonState,
      charStats: newCharStats,
      totalSessions: lessonState.totalSessions + 1,
      totalCharsTyped: lessonState.totalCharsTyped + typedText.length,
      totalCorrect: lessonState.totalCorrect + liveStats.correct,
      bestWpm: Math.max(lessonState.bestWpm, liveStats.wpm),
      currentStreak: newStreak,
      lastSessionDate: today
    };
    
    // Check for new char unlock
    const unlocked = checkForUnlock(newState);
    if (unlocked) {
      newState.activeChars = [...newState.activeChars, unlocked];
      newState.charStats[unlocked] = { attempts: 0, errors: 0, lastPracticed: Date.now() };
      setNewCharUnlocked(unlocked);
    }
    
    setLessonState(newState);
    saveState(newState);
  }, [lessonState, typedText, liveStats]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished) return;
    
    // Prevent paste
    const newValue = e.target.value;
    if (newValue.length > typedText.length + 1) return;
    
    if (!isStarted) {
      setIsStarted(true);
    }
    
    // Track character stats for this session
    if (newValue.length > typedText.length) {
      const newChar = newValue[newValue.length - 1].toLowerCase();
      const expectedChar = currentText[newValue.length - 1]?.toLowerCase();
      
      if (expectedChar && lessonState.activeChars.includes(expectedChar)) {
        sessionAttemptsRef.current[expectedChar] = (sessionAttemptsRef.current[expectedChar] || 0) + 1;
        if (newChar !== expectedChar) {
          sessionErrorsRef.current[expectedChar] = (sessionErrorsRef.current[expectedChar] || 0) + 1;
        }
      }
    }
    
    setTypedText(newValue);
    
    // Check if completed
    if (newValue.length >= currentText.length) {
      endSession();
    }
  };

  const resetSession = () => {
    setTypedText("");
    setTimeLeft(SESSION_LENGTH);
    setIsStarted(false);
    setIsFinished(false);
    setSessionStats(null);
    setNewCharUnlocked(null);
    sessionErrorsRef.current = {};
    sessionAttemptsRef.current = {};
    setCurrentText(generateLesson(lessonState));
    inputRef.current?.focus();
  };

  const resetProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLessonState(loadState());
    resetSession();
  };

  // Render text with highlighting
  const renderText = () => {
    return currentText.split("").map((char, index) => {
      let className = "transition-all duration-100 ";
      
      if (index < typedText.length) {
        if (typedText[index] === char) {
          className += "text-emerald-400";
        } else {
          className += "text-rose-400 bg-rose-500/30 rounded";
        }
      } else if (index === typedText.length) {
        className += "border-l-2 border-indigo-400 text-white animate-pulse";
      } else {
        className += "text-white/40";
      }
      
      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  // Calculate progress percentage
  const progressPercent = (lessonState.activeChars.length / CHAR_PROGRESSION.length) * 100;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D Background with Keyboard */}
      <Keyboard3DCanvas pressedKey={pressedKey} />
      
      {/* Mini Earth decorations */}
      <div className="absolute top-4 left-4 z-20">
        <MiniEarthCanvas />
      </div>
      <div className="absolute top-4 right-4 z-20">
        <MiniEarthCanvas />
      </div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center pt-6 px-4 pb-8">
        {/* Header */}
        <div className="text-center mb-4">
          <Link 
            to="/" 
            className="inline-block mb-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            ← Back to Portfolio
          </Link>
          <motion.h1 
            className="text-3xl md:text-4xl font-bold text-white mb-1"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ⌨️ Adaptive Typing Trainer
          </motion.h1>
          <p className="text-white/60 text-sm">Master typing with smart, personalized lessons</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView("practice")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              view === "practice" 
                ? "bg-indigo-600 text-white" 
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Practice
          </button>
          <button
            onClick={() => setView("progress")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              view === "progress" 
                ? "bg-indigo-600 text-white" 
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Progress
          </button>
        </div>

        <AnimatePresence mode="wait">
          {view === "practice" ? (
            <motion.div
              key="practice"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full max-w-3xl"
            >
              {/* Stats Row */}
              <div className="flex justify-center gap-3 md:gap-4 mb-4 flex-wrap">
                <StatCard value={timeLeft} label="Seconds" color="text-indigo-400" />
                <StatCard value={liveStats.wpm} label="WPM" color="text-emerald-400" />
                <StatCard value={`${liveStats.accuracy}%`} label="Accuracy" color="text-cyan-400" />
                <StatCard value={lessonState.currentStreak} label="🔥 Streak" color="text-amber-400" />
              </div>

              {/* Active Characters */}
              <Card3D className="p-3 mb-4" depth={1}>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="text-white/60 text-sm">Active:</span>
                  {lessonState.activeChars.slice(0, 12).map(char => {
                    const stats = lessonState.charStats[char];
                    const accuracy = stats && stats.attempts > 0 
                      ? 1 - (stats.errors / stats.attempts) 
                      : -1;
                    return (
                      <CharTile
                        key={char}
                        char={char}
                        accuracy={accuracy}
                        isActive={true}
                      />
                    );
                  })}
                  {lessonState.activeChars.length > 12 && (
                    <span className="text-white/40 text-sm">+{lessonState.activeChars.length - 12} more</span>
                  )}
                </div>
              </Card3D>

              {/* Text Display */}
              <Card3D
                className={`p-6 mb-4 cursor-text transition-all ${
                  isStarted && !isFinished ? "ring-2 ring-indigo-500/50" : ""
                }`}
                depth={2}
              >
                <div onClick={() => inputRef.current?.focus()}>
                  <p className="text-lg md:text-xl font-mono leading-relaxed tracking-wide min-h-[100px]">
                    {renderText()}
                  </p>
                </div>
              </Card3D>

              {/* Hidden Input */}
              <textarea
                ref={inputRef}
                value={typedText}
                onChange={handleInput}
                disabled={isFinished}
                className="absolute opacity-0 pointer-events-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onPaste={(e) => e.preventDefault()}
              />

              {/* Instructions / Actions */}
              <div className="text-center">
                {!isStarted && !isFinished && (
                  <motion.p
                    className="text-white/60 mb-4"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    Click the text area and start typing to begin...
                  </motion.p>
                )}
                
                <button
                  onClick={resetSession}
                  className={`px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl 
                             hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20
                             ${isStarted && !isFinished ? "opacity-50" : ""}`}
                >
                  🔄 {isFinished ? "New Session" : "Reset"}
                </button>
              </div>

              <p className="mt-3 text-white/40 text-xs text-center">
                Watch the 3D keyboard below as you type!
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="progress"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-3xl space-y-4"
            >
              {/* Overall Stats */}
              <Card3D className="p-6" depth={2}>
                <h2 className="text-xl font-semibold text-white mb-4">📊 Your Progress</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-400">{lessonState.totalSessions}</div>
                    <div className="text-white/60 text-sm">Sessions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">{lessonState.bestWpm}</div>
                    <div className="text-white/60 text-sm">Best WPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-cyan-400">
                      {lessonState.totalCharsTyped > 0 
                        ? Math.round((lessonState.totalCorrect / lessonState.totalCharsTyped) * 100)
                        : 0}%
                    </div>
                    <div className="text-white/60 text-sm">Avg Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-400">{lessonState.currentStreak}🔥</div>
                    <div className="text-white/60 text-sm">Day Streak</div>
                  </div>
                </div>
              </Card3D>

              {/* Character Mastery */}
              <Card3D className="p-6" depth={1}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">🎯 Character Mastery</h2>
                  <ProgressRing progress={progressPercent} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHAR_PROGRESSION.map(char => {
                    const isActive = lessonState.activeChars.includes(char);
                    const stats = lessonState.charStats[char];
                    const accuracy = stats && stats.attempts > 0 
                      ? 1 - (stats.errors / stats.attempts) 
                      : -1;
                    return (
                      <CharTile
                        key={char}
                        char={char}
                        accuracy={isActive ? accuracy : -1}
                        isActive={isActive}
                      />
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-4 text-sm text-white/60">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500/30" /> 90%+
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-amber-500/30" /> 70-89%
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-rose-500/30" /> &lt;70%
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-slate-700/50" /> Locked
                  </span>
                </div>
              </Card3D>

              {/* Weak Characters */}
              {getWeakChars(lessonState.charStats, lessonState.activeChars).length > 0 && (
                <Card3D className="p-6" depth={1}>
                  <h2 className="text-xl font-semibold text-white mb-3">⚠️ Focus on These</h2>
                  <p className="text-white/60 mb-3 text-sm">
                    These characters need more practice to reach 85% accuracy:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getWeakChars(lessonState.charStats, lessonState.activeChars).map(char => {
                      const stats = lessonState.charStats[char];
                      const accuracy = stats ? Math.round((1 - stats.errors / stats.attempts) * 100) : 0;
                      return (
                        <div key={char} className="flex items-center gap-2 bg-rose-500/20 px-3 py-2 rounded-lg">
                          <span className="font-mono text-lg text-white font-bold">{char.toUpperCase()}</span>
                          <span className="text-rose-400 text-sm">{accuracy}%</span>
                        </div>
                      );
                    })}
                  </div>
                </Card3D>
              )}

              {/* Reset Progress */}
              <div className="text-center pt-4">
                <button
                  onClick={resetProgress}
                  className="px-4 py-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/30 transition-all text-sm"
                >
                  Reset All Progress
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Complete Modal */}
        <AnimatePresence>
          {sessionStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-md"
              >
                <Card3D className="p-8" depth={2}>
                  <h2 className="text-2xl font-bold text-white text-center mb-6">
                    {sessionStats.accuracy >= 90 ? "🎉 Excellent!" : 
                     sessionStats.accuracy >= 70 ? "👍 Good Job!" : "💪 Keep Practicing!"}
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className="text-3xl font-bold text-emerald-400">{sessionStats.wpm}</div>
                      <div className="text-white/60 text-sm">WPM</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className="text-3xl font-bold text-cyan-400">{sessionStats.accuracy}%</div>
                      <div className="text-white/60 text-sm">Accuracy</div>
                    </div>
                  </div>

                  {newCharUnlocked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-center mb-6 p-4 bg-indigo-500/20 rounded-xl border border-indigo-500/50"
                    >
                      <div className="text-lg text-white mb-1">🔓 New Character Unlocked!</div>
                      <div className="text-4xl font-bold text-indigo-400">{newCharUnlocked.toUpperCase()}</div>
                    </motion.div>
                  )}

                  {sessionStats.weakChars.length > 0 && (
                    <div className="mb-6">
                      <p className="text-white/60 text-sm mb-2">Focus on these keys:</p>
                      <div className="flex gap-2 justify-center">
                        {sessionStats.weakChars.slice(0, 3).map(char => (
                          <span key={char} className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-lg font-mono font-bold">
                            {char.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSessionStats(null);
                        setView("progress");
                      }}
                      className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
                    >
                      View Progress
                    </button>
                    <button
                      onClick={() => {
                        setSessionStats(null);
                        resetSession();
                      }}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all font-semibold"
                    >
                      Continue
                    </button>
                  </div>
                </Card3D>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Speed;
