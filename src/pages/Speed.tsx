import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Keyboard3DCanvas, MiniEarthCanvas } from "../components/canvas";

// Sample paragraphs for typing practice
const paragraphs = [
  "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet, making it perfect for typing practice.",
  "Programming is the art of telling a computer what to do through a series of instructions. It requires patience, logic, and creativity.",
  "Technology has transformed the way we live, work, and communicate. From smartphones to artificial intelligence, innovation continues to shape our future.",
  "Success is not final, failure is not fatal. It is the courage to continue that counts. Every great achievement started with a single step forward.",
  "The internet has connected billions of people across the globe. Information flows freely, enabling learning and collaboration like never before.",
  "Coding is like solving puzzles. Each problem has multiple solutions, and finding the most elegant one is both challenging and rewarding.",
  "Practice makes perfect. The more you type, the faster and more accurate you become. Consistency is the key to mastering any skill.",
  "Web development combines creativity with technical skills. Building websites that are both beautiful and functional is a valuable modern skill.",
  "Learning to type quickly is an essential skill in today's digital world. It saves time and increases productivity in almost every profession.",
  "The best way to predict the future is to create it. Innovation starts with imagination and becomes reality through dedicated effort and hard work."
];

const Speed = () => {
  const [currentParagraph, setCurrentParagraph] = useState("");
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [correctChars, setCorrectChars] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [pressedKey, setPressedKey] = useState("");
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize with random paragraph
  const init = useCallback(() => {
    const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
    setCurrentParagraph(randomParagraph);
    setTypedText("");
    setTimeLeft(60);
    setIsStarted(false);
    setIsFinished(false);
    setCorrectChars(0);
    setShowResult(false);
    setPressedKey("");
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    init();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [init]);

  // Handle key press for 3D keyboard visualization
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKey(e.key);
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
  }, []);

  // Start timer
  const startTimer = useCallback(() => {
    if (isStarted) return;
    setIsStarted(true);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsFinished(true);
          setShowResult(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isStarted]);

  // Handle input
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;
    
    if (!isStarted) {
      startTimer();
    }
    
    const value = e.target.value;
    setTypedText(value);
    
    // Count correct characters
    let correct = 0;
    value.split("").forEach((char, index) => {
      if (index < currentParagraph.length && char === currentParagraph[index]) {
        correct++;
      }
    });
    setCorrectChars(correct);
    
    // Check if completed
    if (value.length >= currentParagraph.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsFinished(true);
      setShowResult(true);
    }
  };

  // Calculate stats
  const timeElapsed = isStarted ? (60 - timeLeft) / 60 : 0;
  const wpm = timeElapsed > 0 ? Math.round((correctChars / 5) / timeElapsed) : 0;
  const accuracy = typedText.length > 0 ? Math.round((correctChars / typedText.length) * 100) : 100;

  // Render characters with highlighting
  const renderText = () => {
    return currentParagraph.split("").map((char, index) => {
      let className = "transition-colors duration-100";
      
      if (index < typedText.length) {
        if (typedText[index] === char) {
          className += " text-green-400";
        } else {
          className += " text-red-400 bg-red-500/30 rounded";
        }
      } else if (index === typedText.length) {
        className += " border-l-2 border-indigo-400 animate-pulse";
      } else {
        className += " text-gray-400";
      }
      
      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D Background with Keyboard */}
      <Keyboard3DCanvas pressedKey={pressedKey} />
      
      {/* Mini Earth - Top Left */}
      <div className="absolute top-4 left-4 z-20">
        <MiniEarthCanvas />
      </div>
      
      {/* Mini Earth - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <MiniEarthCanvas />
      </div>
      
      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-start pt-8 px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <Link 
            to="/" 
            className="inline-block mb-4 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            ⌨️ Speed Test
          </h1>
          <p className="text-gray-400">Test your typing skills</p>
        </div>

        {/* Stats Row */}
        <div className="flex justify-center gap-6 md:gap-10 mb-6 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
          <div className="text-center">
            <span className="block text-3xl md:text-4xl font-bold text-indigo-400">{timeLeft}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">seconds</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl md:text-4xl font-bold text-green-400">{wpm}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">WPM</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl md:text-4xl font-bold text-cyan-400">{accuracy}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">% accuracy</span>
          </div>
        </div>

        {/* Text Display */}
        <div 
          className={`w-full max-w-3xl p-6 md:p-8 bg-black/50 backdrop-blur-md rounded-2xl mb-4 min-h-[140px] 
                     border-2 transition-all cursor-text ${
            isStarted && !isFinished ? "border-indigo-500/50" : "border-white/10"
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          <p className="text-lg md:text-xl font-mono leading-relaxed tracking-wide">
            {renderText()}
          </p>
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={typedText}
          onChange={handleInput}
          disabled={isFinished}
          placeholder="Start typing here..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full max-w-3xl p-4 text-lg font-mono border-2 border-white/10 rounded-xl 
                     bg-black/50 backdrop-blur-md text-white 
                     focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
        />

        {/* Restart Button */}
        <div className={`flex justify-center mt-5 transition-opacity ${isStarted && !isFinished ? "opacity-30 hover:opacity-100" : ""}`}>
          <button
            onClick={init}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 
                       transition-all hover:-translate-y-0.5 shadow-lg hover:shadow-indigo-500/25"
          >
            🔄 Restart
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-4 text-gray-500 text-sm">
          Watch the 3D keyboard below as you type!
        </p>

        {/* Result Modal */}
        {showResult && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-5">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-10 md:p-12 rounded-2xl text-center 
                           shadow-2xl max-w-md w-full border border-white/10 animate-in zoom-in-95">
              <h2 className="text-3xl font-bold mb-8 text-white">🎉 Time's Up!</h2>
              
              <div className="space-y-4 mb-8">
                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                  <span className="block text-3xl font-bold text-green-400">{wpm}</span>
                  <span className="text-sm text-gray-400">Words Per Minute</span>
                </div>
                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                  <span className="block text-3xl font-bold text-cyan-400">{accuracy}%</span>
                  <span className="text-sm text-gray-400">Accuracy</span>
                </div>
                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                  <span className="block text-3xl font-bold text-indigo-400">{correctChars}</span>
                  <span className="text-sm text-gray-400">Characters Typed</span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowResult(false);
                  setTimeout(init, 100);
                }}
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 
                           transition-all hover:-translate-y-0.5 shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Speed;
