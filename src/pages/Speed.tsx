import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

import type {
  LessonState,
  SessionStats,
  TestConfig,
  TestMode,
  WpmSample,
  SessionRecord,
} from "./typing/types";
import { THEMES, getTheme } from "./typing/themes";
import {
  loadState,
  saveState,
  resetState,
  loadPrefs,
  savePrefs,
  CHAR_PROGRESSION,
  type Prefs,
} from "./typing/storage";
import {
  generateTest,
  checkForUnlock,
  getWeakChars,
  computeConsistency,
  getKeyAccuracy,
} from "./typing/engine";
import { playKey, playError, playUnlock } from "./typing/sound";
import WpmChart from "./components/WpmChart";
import KeyHeatmap from "./components/KeyHeatmap";
import KeybrKeyboard from "./components/KeybrKeyboard";

// ============ SMALL UI HELPERS ============
const Pill: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent: string;
}> = ({ active, onClick, children, accent }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
    style={{
      background: active ? accent : "rgba(255,255,255,0.06)",
      color: active ? "#0b0b14" : "rgba(255,255,255,0.65)",
    }}
  >
    {children}
  </button>
);

const StatBlock: React.FC<{ value: string | number; label: string; color: string; big?: boolean }> = ({
  value,
  label,
  color,
  big,
}) => (
  <div className="text-center">
    <motion.div
      key={value}
      initial={{ scale: 1.12, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={`font-bold ${big ? "text-5xl md:text-6xl" : "text-2xl md:text-3xl"}`}
      style={{ color }}
    >
      {value}
    </motion.div>
    <div className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
      {label}
    </div>
  </div>
);

// ============ AUTH BUTTON (Google via Supabase) ============
const AuthButton: React.FC<{ accent: string; sub: string; text: string }> = ({
  accent,
  sub,
  text,
}) => {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle("/speed"); // return to the typing page after OAuth
    } catch (e) {
      console.error("Sign-in failed:", e);
    }
  };

  if (loading) {
    return (
      <div
        className="w-8 h-8 rounded-full animate-pulse"
        style={{ background: sub + "44" }}
      />
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
        style={{ background: "#ffffff", color: "#1f2937" }}
        title="Sign in with Google to sync progress"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in
      </button>
    );
  }

  const name = profile?.full_name || user.email?.split("@")[0] || "You";
  const avatar = profile?.avatar_url;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
        title={name}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-8 h-8 rounded-full" style={{ border: `2px solid ${accent}` }} />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: accent, color: "#0b0b14" }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-44 rounded-xl p-2 z-50"
            style={{ background: "#0b0b14", border: `1px solid ${sub}33` }}
          >
            <div className="px-3 py-2 text-sm truncate" style={{ color: text }}>
              {name}
            </div>
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
              style={{ color: sub }}
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ MAIN COMPONENT ============
const Speed: React.FC = () => {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [lessonState, setLessonState] = useState<LessonState>(loadState);

  const [currentText, setCurrentText] = useState("");
  const [quoteSource, setQuoteSource] = useState<string | undefined>();
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(prefs.config.timeSec);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [pressedKey, setPressedKey] = useState("");
  const [newCharUnlocked, setNewCharUnlocked] = useState<string | null>(null);
  const [view, setView] = useState<"practice" | "progress">("practice");
  const [heatMetric, setHeatMetric] = useState<"speed" | "accuracy">("speed");
  const [liveSamples, setLiveSamples] = useState<WpmSample[]>([]);
  const [focusMode, setFocusMode] = useState(false);

  const theme = useMemo(() => getTheme(prefs.themeId), [prefs.themeId]);
  const { config } = prefs;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionErrorsRef = useRef<Record<string, number>>({});
  const sessionAttemptsRef = useRef<Record<string, number>>({});
  const sessionTimeRef = useRef<Record<string, number>>({}); // ms per char
  const lastKeyTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<WpmSample[]>([]);
  const lastSampleStateRef = useRef<{ correct: number; errors: number }>({ correct: 0, errors: 0 });
  const typedRef = useRef("");
  const textRef = useRef("");

  // ---- persistence of prefs ----
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const updateConfig = (patch: Partial<TestConfig>) => {
    setPrefs((p) => ({ ...p, config: { ...p.config, ...patch } }));
  };

  // ---- build a fresh test ----
  const buildTest = useCallback(() => {
    const { text, source } = generateTest(config.mode, lessonState, {
      wordCount: config.wordCount,
      punctuation: config.punctuation,
      numbers: config.numbers,
    });
    setCurrentText(text);
    textRef.current = text;
    setQuoteSource(source);
  }, [config.mode, config.wordCount, config.punctuation, config.numbers, lessonState.activeChars]);

  useEffect(() => {
    buildTest();
  }, [config.mode, config.wordCount, config.punctuation, config.numbers, lessonState.activeChars]);

  useEffect(() => {
    setTimeLeft(config.timeSec);
  }, [config.timeSec]);

  // ---- autofocus ----
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // ---- global key handling (visualization + tab restart + focus typing) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab to restart (monkeytype-style)
      if (e.key === "Tab") {
        e.preventDefault();
        resetSession();
        return;
      }
      setPressedKey(e.key);
      if (!isFinished && e.key.length === 1) {
        inputRef.current?.focus();
      }
    };
    const handleKeyUp = () => setPressedKey("");
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, currentText]);

  // ---- live stats ----
  const liveStats = useMemo(() => {
    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typedText.length; i++) {
      if (i < currentText.length) {
        if (typedText[i] === currentText[i]) correct++;
        else errors++;
      }
    }
    const elapsedMin =
      isStarted && startTimeRef.current > 0 ? (Date.now() - startTimeRef.current) / 60000 : 0;
    const wpm = elapsedMin > 0 ? Math.round(correct / 5 / elapsedMin) : 0;
    const rawWpm = elapsedMin > 0 ? Math.round(typedText.length / 5 / elapsedMin) : 0;
    const accuracy = typedText.length > 0 ? Math.round((correct / typedText.length) * 100) : 100;
    return { wpm, rawWpm, accuracy, correct, errors };
  }, [typedText, currentText, isStarted, timeLeft]);

  // ---- per-second sampler for the graph ----
  const startSampler = useCallback(() => {
    if (sampleRef.current) clearInterval(sampleRef.current);
    samplesRef.current = [];
    lastSampleStateRef.current = { correct: 0, errors: 0 };
    setLiveSamples([]);
    sampleRef.current = setInterval(() => {
      const typed = typedRef.current;
      const text = textRef.current;
      let correct = 0;
      let errors = 0;
      for (let i = 0; i < typed.length; i++) {
        if (i < text.length) {
          if (typed[i] === text[i]) correct++;
          else errors++;
        }
      }
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      if (elapsedSec <= 0) return;
      const elapsedMin = elapsedSec / 60;
      const wpm = Math.round(correct / 5 / elapsedMin);
      const raw = Math.round(typed.length / 5 / elapsedMin);
      const prev = lastSampleStateRef.current;
      const newErrors = Math.max(0, errors - prev.errors);
      lastSampleStateRef.current = { correct, errors };
      const sample: WpmSample = { time: Math.round(elapsedSec), wpm, raw, errors: newErrors };
      samplesRef.current = [...samplesRef.current, sample];
      setLiveSamples(samplesRef.current);
    }, 1000);
  }, []);

  // ---- timer (time mode) ----
  useEffect(() => {
    if (isStarted && !isFinished && config.mode === "time") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted, isFinished, config.mode]);

  // ---- end session ----
  const endSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sampleRef.current) clearInterval(sampleRef.current);
    setIsFinished(true);

    const typed = typedRef.current;
    const text = textRef.current;
    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typed.length; i++) {
      if (i < text.length) {
        if (typed[i] === text[i]) correct++;
        else errors++;
      }
    }
    const elapsedMin = Math.max(0.001, (Date.now() - startTimeRef.current) / 60000);
    const wpm = Math.round(correct / 5 / elapsedMin);
    const rawWpm = Math.round(typed.length / 5 / elapsedMin);
    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;

    // Ensure at least one sample for the chart
    let samples = samplesRef.current;
    if (samples.length === 0) {
      samples = [{ time: Math.round(elapsedMin * 60), wpm, raw: rawWpm, errors }];
    }
    const consistency = computeConsistency(samples);

    // merge char stats
    const newCharStats = { ...lessonState.charStats };
    Object.entries(sessionAttemptsRef.current).forEach(([char, attempts]) => {
      if (!newCharStats[char]) {
        newCharStats[char] = { attempts: 0, errors: 0, totalTime: 0, lastPracticed: Date.now() };
      }
      newCharStats[char].attempts += attempts;
      newCharStats[char].errors += sessionErrorsRef.current[char] || 0;
      newCharStats[char].totalTime += sessionTimeRef.current[char] || 0;
      newCharStats[char].lastPracticed = Date.now();
    });

    const weakChars = getWeakChars(newCharStats, lessonState.activeChars);

    const stats: SessionStats = {
      wpm,
      rawWpm,
      accuracy,
      consistency,
      charsTyped: typed.length,
      errors,
      weakChars,
      samples,
      durationSec: Math.round(elapsedMin * 60),
    };
    setSessionStats(stats);

    const today = new Date().toISOString().split("T")[0];
    const newStreak =
      lessonState.lastSessionDate === today
        ? lessonState.currentStreak
        : lessonState.currentStreak + 1;

    const record: SessionRecord = {
      date: Date.now(),
      mode: config.mode,
      wpm,
      rawWpm,
      accuracy,
      consistency,
      charsTyped: typed.length,
    };

    const newState: LessonState = {
      ...lessonState,
      charStats: newCharStats,
      totalSessions: lessonState.totalSessions + 1,
      totalCharsTyped: lessonState.totalCharsTyped + typed.length,
      totalCorrect: lessonState.totalCorrect + correct,
      bestWpm: Math.max(lessonState.bestWpm, wpm),
      currentStreak: newStreak,
      lastSessionDate: today,
      history: [...lessonState.history, record],
    };

    // Adaptive unlock only in adaptive mode
    if (config.mode === "adaptive") {
      const unlocked = checkForUnlock(newState);
      if (unlocked) {
        newState.activeChars = [...newState.activeChars, unlocked];
        newState.charStats[unlocked] = {
          attempts: 0,
          errors: 0,
          totalTime: 0,
          lastPracticed: Date.now(),
        };
        setNewCharUnlocked(unlocked);
        if (prefs.sound) playUnlock();
      }
    }

    setLessonState(newState);
    saveState(newState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonState, config.mode, prefs.sound]);

  // ---- input handling ----
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished) return;
    const newValue = e.target.value;
    if (newValue.length > typedText.length + 1) return; // block paste

    const now = Date.now();
    if (!isStarted) {
      setIsStarted(true);
      startTimeRef.current = now;
      lastKeyTimeRef.current = now;
      startSampler();
    }

    if (newValue.length > typedText.length) {
      const idx = newValue.length - 1;
      const typedChar = newValue[idx].toLowerCase();
      const expectedChar = currentText[idx]?.toLowerCase();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (expectedChar && expectedChar !== " ") {
        sessionAttemptsRef.current[expectedChar] = (sessionAttemptsRef.current[expectedChar] || 0) + 1;
        if (typedChar !== expectedChar) {
          sessionErrorsRef.current[expectedChar] = (sessionErrorsRef.current[expectedChar] || 0) + 1;
          if (prefs.sound) playError();
        } else {
          // only count plausible timing (ignore long pauses > 2s)
          if (delta > 0 && delta < 2000) {
            sessionTimeRef.current[expectedChar] = (sessionTimeRef.current[expectedChar] || 0) + delta;
          }
          if (prefs.sound) playKey();
        }
      } else if (prefs.sound) {
        playKey();
      }
    }

    setTypedText(newValue);
    typedRef.current = newValue;

    // completion (words / quote / adaptive)
    if (config.mode !== "time" && newValue.length >= currentText.length) {
      endSession();
    }
  };

  // ---- reset ----
  const resetSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sampleRef.current) clearInterval(sampleRef.current);
    setTypedText("");
    typedRef.current = "";
    setTimeLeft(config.timeSec);
    setIsStarted(false);
    setIsFinished(false);
    setSessionStats(null);
    setNewCharUnlocked(null);
    setLiveSamples([]);
    samplesRef.current = [];
    sessionErrorsRef.current = {};
    sessionAttemptsRef.current = {};
    sessionTimeRef.current = {};
    startTimeRef.current = 0;
    buildTest();
    setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.timeSec, buildTest]);

  const handleResetProgress = () => {
    setLessonState(resetState());
    resetSession();
  };

  // ---- text rendering with animated caret ----
  const renderText = () => {
    // For time mode show a sliding window so it doesn't get huge
    const chars = currentText.split("");
    return chars.map((char, index) => {
      let color = theme.text; // upcoming text is bright & readable
      let bg = "transparent";
      let opacity = 1;
      const isCaret = index === typedText.length;
      if (index < typedText.length) {
        if (typedText[index] === char) {
          color = theme.sub; // finished-correct text dims back
          opacity = 0.85;
        } else {
          color = theme.error;
          bg = char === " " ? theme.errorExtra + "55" : theme.error + "33";
        }
      } else {
        opacity = 0.85; // upcoming
      }
      return (
        <span key={index} className="relative rounded-sm" style={{ color, background: bg, opacity }}>
          {isCaret && (
            <motion.span
              layoutId="caret"
              className="absolute -left-[1px] top-0 bottom-0 w-[2px] rounded"
              style={{ background: theme.caret }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}
          {char}
        </span>
      );
    });
  };

  const progressPercent = (lessonState.activeChars.length / CHAR_PROGRESSION.length) * 100;

  // Next key the user must press (drives the keybr-style blue ring)
  const nextKey = currentText[typedText.length] ?? "";

  // In non-adaptive modes every key is in play, so light the whole board.
  const ALL_KEYS = "abcdefghijklmnopqrstuvwxyz,.;1234567890 ".split("");
  const keyboardActiveChars = config.mode === "adaptive" ? lessonState.activeChars : ALL_KEYS;

  const modeLabels: Record<TestMode, string> = {
    adaptive: "adaptive",
    words: "words",
    time: "time",
    quote: "quote",
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: theme.bg }}>
      <div className="relative z-10 min-h-screen flex flex-col items-center pt-6 px-4 pb-8">
        {/* Header */}
        <div className="text-center mb-3 w-full max-w-3xl flex items-center justify-between">
          <Link
            to="/"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: theme.accent }}
          >
            ← Portfolio
          </Link>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: theme.text }}>
            ⌨️ Adaptive Typing Trainer
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFocusMode((f) => !f)}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: focusMode ? theme.accent : theme.sub }}
              title="Toggle focus mode"
            >
              {focusMode ? "◉ focus" : "○ focus"}
            </button>
            <AuthButton accent={theme.accent} sub={theme.sub} text={theme.text} />
          </div>
        </div>

        {/* View toggle */}
        {!focusMode && (
          <div className="flex gap-2 mb-3">
            <Pill active={view === "practice"} onClick={() => setView("practice")} accent={theme.accent}>
              Practice
            </Pill>
            <Pill active={view === "progress"} onClick={() => setView("progress")} accent={theme.accent}>
              Progress
            </Pill>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "practice" ? (
            <motion.div
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl"
            >
              {/* Config bar */}
              {!focusMode && !isStarted && (
                <div
                  className="flex flex-wrap items-center justify-center gap-2 mb-4 p-2 rounded-xl"
                  style={{ background: theme.bgAccent }}
                >
                  {(["adaptive", "words", "time", "quote"] as TestMode[]).map((m) => (
                    <Pill key={m} active={config.mode === m} onClick={() => updateConfig({ mode: m })} accent={theme.accent}>
                      {modeLabels[m]}
                    </Pill>
                  ))}

                  <div className="w-px h-5 mx-1" style={{ background: theme.sub + "55" }} />

                  {config.mode === "time" &&
                    [15, 30, 60, 120].map((t) => (
                      <Pill key={t} active={config.timeSec === t} onClick={() => updateConfig({ timeSec: t })} accent={theme.accent}>
                        {t}
                      </Pill>
                    ))}
                  {config.mode === "words" &&
                    [10, 25, 50, 100].map((w) => (
                      <Pill key={w} active={config.wordCount === w} onClick={() => updateConfig({ wordCount: w })} accent={theme.accent}>
                        {w}
                      </Pill>
                    ))}

                  {(config.mode === "words" || config.mode === "time") && (
                    <>
                      <div className="w-px h-5 mx-1" style={{ background: theme.sub + "55" }} />
                      <Pill active={config.punctuation} onClick={() => updateConfig({ punctuation: !config.punctuation })} accent={theme.accent}>
                        @ punctuation
                      </Pill>
                      <Pill active={config.numbers} onClick={() => updateConfig({ numbers: !config.numbers })} accent={theme.accent}>
                        # numbers
                      </Pill>
                    </>
                  )}
                </div>
              )}

              {/* Live stat strip */}
              <div className="flex justify-center gap-6 md:gap-10 mb-4">
                {config.mode === "time" && (
                  <StatBlock value={timeLeft} label="time" color={theme.accent} />
                )}
                <StatBlock value={liveStats.wpm} label="wpm" color={theme.text} />
                <StatBlock value={`${liveStats.accuracy}%`} label="acc" color={theme.text} />
                {config.mode === "adaptive" && (
                  <StatBlock value={lessonState.currentStreak} label="🔥 streak" color={theme.accent} />
                )}
              </div>

              {/* Live mini graph */}
              {isStarted && !isFinished && liveSamples.length > 1 && (
                <div className="mb-3 rounded-xl p-2" style={{ background: theme.bgAccent }}>
                  <WpmChart samples={liveSamples} theme={theme} height={120} />
                </div>
              )}

              {/* Active chars (adaptive only) */}
              {config.mode === "adaptive" && !focusMode && !isStarted && (
                <div className="flex items-center gap-2 flex-wrap justify-center mb-3">
                  <span className="text-sm" style={{ color: theme.sub }}>
                    Active keys:
                  </span>
                  {lessonState.activeChars.map((char) => {
                    const acc = getKeyAccuracy(lessonState.charStats[char]);
                    const c =
                      acc < 0 ? theme.sub : acc >= 0.9 ? "#22c55e" : acc >= 0.7 ? "#eab308" : theme.error;
                    return (
                      <span
                        key={char}
                        className="w-7 h-7 rounded flex items-center justify-center font-mono text-sm font-bold"
                        style={{ border: `1px solid ${c}`, color: c }}
                      >
                        {char.toUpperCase()}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Text area */}
              <div
                onClick={() => inputRef.current?.focus()}
                className="p-6 mb-4 rounded-2xl cursor-text"
                style={{ background: theme.bgAccent, border: `1px solid ${theme.sub}22` }}
              >
                <p className="text-2xl md:text-3xl font-mono leading-relaxed tracking-wide min-h-[110px] break-words">
                  {renderText()}
                </p>
                {quoteSource && (
                  <p className="mt-3 text-right text-sm" style={{ color: theme.sub }}>
                    — {quoteSource}
                  </p>
                )}
              </div>

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

              {/* Actions */}
              <div className="text-center">
                {!isStarted && !isFinished && (
                  <motion.p
                    className="mb-3 text-sm"
                    style={{ color: theme.sub }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    start typing to begin · <kbd className="px-1.5 py-0.5 rounded" style={{ background: theme.bgAccent }}>Tab</kbd> to restart
                  </motion.p>
                )}
                <button
                  onClick={resetSession}
                  className="px-6 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90"
                  style={{ background: theme.accent, color: "#0b0b14" }}
                >
                  🔄 {isFinished ? "Next" : "Restart"}
                </button>
              </div>

              {/* keybr-style live keyboard */}
              <div className="mt-6">
                <KeybrKeyboard
                  charStats={lessonState.charStats}
                  activeChars={keyboardActiveChars}
                  theme={theme}
                  nextKey={nextKey}
                  pressedKey={pressedKey}
                />
              </div>

              {/* Theme + sound bar */}
              {!focusMode && !isStarted && (
                <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                  <span className="text-xs" style={{ color: theme.sub }}>
                    theme:
                  </span>
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setPrefs((p) => ({ ...p, themeId: t.id }))}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                      title={t.name}
                      style={{
                        background: t.accent,
                        outline: prefs.themeId === t.id ? `2px solid ${theme.text}` : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                  <div className="w-px h-5 mx-1" style={{ background: theme.sub + "55" }} />
                  <button
                    onClick={() => setPrefs((p) => ({ ...p, sound: !p.sound }))}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: prefs.sound ? theme.accent : theme.bgAccent,
                      color: prefs.sound ? "#0b0b14" : theme.sub,
                    }}
                  >
                    {prefs.sound ? "🔊 sound on" : "🔇 sound off"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl space-y-4"
            >
              {/* Overall stats */}
              <div className="p-6 rounded-2xl" style={{ background: theme.bgAccent }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: theme.text }}>
                  📊 Your Progress
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatBlock value={lessonState.totalSessions} label="sessions" color={theme.accent} />
                  <StatBlock value={lessonState.bestWpm} label="best wpm" color={theme.text} />
                  <StatBlock
                    value={`${
                      lessonState.totalCharsTyped > 0
                        ? Math.round((lessonState.totalCorrect / lessonState.totalCharsTyped) * 100)
                        : 0
                    }%`}
                    label="avg acc"
                    color={theme.text}
                  />
                  <StatBlock value={`${lessonState.currentStreak}🔥`} label="streak" color={theme.accent} />
                </div>
              </div>

              {/* Heatmap */}
              <div className="p-6 rounded-2xl" style={{ background: theme.bgAccent }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
                    🎯 Keyboard Heatmap
                  </h2>
                  <div className="flex gap-2">
                    <Pill active={heatMetric === "speed"} onClick={() => setHeatMetric("speed")} accent={theme.accent}>
                      speed
                    </Pill>
                    <Pill active={heatMetric === "accuracy"} onClick={() => setHeatMetric("accuracy")} accent={theme.accent}>
                      accuracy
                    </Pill>
                  </div>
                </div>
                <KeyHeatmap
                  charStats={lessonState.charStats}
                  activeChars={lessonState.activeChars}
                  theme={theme}
                  metric={heatMetric}
                />
                <p className="mt-4 text-center text-sm" style={{ color: theme.sub }}>
                  {Math.round(progressPercent)}% of keys unlocked
                </p>
              </div>

              {/* History chart */}
              {lessonState.history.length > 1 && (
                <div className="p-6 rounded-2xl" style={{ background: theme.bgAccent }}>
                  <h2 className="text-lg font-semibold mb-3" style={{ color: theme.text }}>
                    📈 WPM History
                  </h2>
                  <WpmChart
                    theme={theme}
                    samples={lessonState.history.slice(-30).map((h, i) => ({
                      time: i,
                      wpm: h.wpm,
                      raw: h.rawWpm,
                      errors: 0,
                    }))}
                    height={160}
                  />
                </div>
              )}

              {/* Weak chars */}
              {getWeakChars(lessonState.charStats, lessonState.activeChars).length > 0 && (
                <div className="p-6 rounded-2xl" style={{ background: theme.bgAccent }}>
                  <h2 className="text-lg font-semibold mb-3" style={{ color: theme.text }}>
                    ⚠️ Focus on These
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {getWeakChars(lessonState.charStats, lessonState.activeChars).map((char) => {
                      const acc = Math.round(getKeyAccuracy(lessonState.charStats[char]) * 100);
                      return (
                        <div
                          key={char}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: theme.error + "22" }}
                        >
                          <span className="font-mono text-lg font-bold" style={{ color: theme.text }}>
                            {char.toUpperCase()}
                          </span>
                          <span className="text-sm" style={{ color: theme.error }}>
                            {acc}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={handleResetProgress}
                  className="px-4 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                  style={{ background: theme.error + "22", color: theme.error }}
                >
                  Reset All Progress
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results modal */}
        <AnimatePresence>
          {sessionStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              style={{ background: "rgba(0,0,0,0.7)" }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-2xl rounded-2xl p-6 md:p-8"
                style={{ background: theme.bg, border: `1px solid ${theme.sub}33` }}
              >
                <div className="flex items-start gap-6 mb-4 flex-wrap">
                  <div className="flex flex-col gap-2">
                    <StatBlock value={sessionStats.wpm} label="wpm" color={theme.accent} big />
                    <StatBlock value={`${sessionStats.accuracy}%`} label="acc" color={theme.text} />
                  </div>
                  <div className="flex-1 min-w-[280px]">
                    <WpmChart samples={sessionStats.samples} theme={theme} height={180} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <div className="text-center p-3 rounded-xl" style={{ background: theme.bgAccent }}>
                    <div className="text-xl font-bold" style={{ color: theme.text }}>
                      {sessionStats.rawWpm}
                    </div>
                    <div className="text-xs" style={{ color: theme.sub }}>raw</div>
                  </div>
                  <div className="text-center p-3 rounded-xl" style={{ background: theme.bgAccent }}>
                    <div className="text-xl font-bold" style={{ color: theme.text }}>
                      {sessionStats.consistency}%
                    </div>
                    <div className="text-xs" style={{ color: theme.sub }}>consistency</div>
                  </div>
                  <div className="text-center p-3 rounded-xl" style={{ background: theme.bgAccent }}>
                    <div className="text-xl font-bold" style={{ color: theme.text }}>
                      {sessionStats.charsTyped}
                    </div>
                    <div className="text-xs" style={{ color: theme.sub }}>chars</div>
                  </div>
                  <div className="text-center p-3 rounded-xl" style={{ background: theme.bgAccent }}>
                    <div className="text-xl font-bold" style={{ color: theme.error }}>
                      {sessionStats.errors}
                    </div>
                    <div className="text-xs" style={{ color: theme.sub }}>errors</div>
                  </div>
                </div>

                {newCharUnlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center mb-4 p-3 rounded-xl"
                    style={{ background: theme.accent + "22", border: `1px solid ${theme.accent}` }}
                  >
                    <span style={{ color: theme.text }}>🔓 New key unlocked! </span>
                    <span className="text-2xl font-bold" style={{ color: theme.accent }}>
                      {newCharUnlocked.toUpperCase()}
                    </span>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSessionStats(null);
                      setView("progress");
                    }}
                    className="flex-1 px-4 py-3 rounded-xl transition-all hover:opacity-80"
                    style={{ background: theme.bgAccent, color: theme.text }}
                  >
                    View Progress
                  </button>
                  <button
                    onClick={() => {
                      setSessionStats(null);
                      resetSession();
                    }}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold transition-all hover:opacity-90"
                    style={{ background: theme.accent, color: "#0b0b14" }}
                  >
                    Next (Tab)
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Speed;
