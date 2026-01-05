import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";

// ============ TYPES ============
interface Subject {
  id: string;
  name: string;
  type: "theory" | "lab";
  credits: number;
  marks: number;
  gradePoint: number;
  grade: string;
  status: "pass" | "back";
}

interface Semester {
  id: string;
  name: string;
  subjects: Subject[];
  sgpa: number;
  totalCredits: number;
  passedSubjects: number;
  backSubjects: number;
}

// ============ GRADING CONSTANTS (IIIT Bhubaneswar) ============
const GRADE_SLABS = [
  { grade: "O", minMarks: 90, maxMarks: 95, minGP: 9.01, maxGP: 10.00 },
  { grade: "E", minMarks: 85, maxMarks: 89, minGP: 8.01, maxGP: 9.00 },
  { grade: "A", minMarks: 70, maxMarks: 84, minGP: 7.01, maxGP: 8.00 },
  { grade: "B", minMarks: 54, maxMarks: 69, minGP: 6.01, maxGP: 7.00 },
  { grade: "C", minMarks: 47, maxMarks: 53, minGP: 5.01, maxGP: 6.00 },
  { grade: "D", minMarks: 35, maxMarks: 46, minGP: 4.01, maxGP: 5.00 },
  { grade: "F", minMarks: 0, maxMarks: 34, minGP: 0.00, maxGP: 4.00 },
];

const STORAGE_KEY = "gradeFlow_iiitbh_v1";

// ============ GRADE CALCULATION ENGINE ============
/**
 * Calculates Grade Point using IIIT Bhubaneswar continuous grading system
 * Formula: GP = LGPg + ((AM - LMg) × 0.99) / (HMg - LMg)
 * 
 * Where:
 * - LGPg = Lower Grade Point of the grade slab
 * - AM = Actual Marks (capped at 95 if > 95)
 * - LMg = Lower Marks boundary of the grade slab
 * - HMg = Higher Marks boundary of the grade slab
 */
const calculateGradePoint = (marks: number): { grade: string; gradePoint: number } => {
  // CRITICAL: Cap marks at 95 if above (96-100 → 95)
  const cappedMarks = Math.min(marks, 95);
  
  // Special case: marks >= 95 → O grade with GP 10.00
  if (marks >= 95) {
    return { grade: "O", gradePoint: 10.00 };
  }
  
  // Find the appropriate grade slab
  const slab = GRADE_SLABS.find(s => cappedMarks >= s.minMarks && cappedMarks <= s.maxMarks);
  
  if (!slab) {
    return { grade: "F", gradePoint: 0.00 };
  }
  
  // Apply the continuous grade point formula:
  // GP = LGPg + ((AM - LMg) × 0.99) / (HMg - LMg)
  const LGPg = slab.minGP;   // Lower grade point of the slab
  const AM = cappedMarks;     // Actual marks
  const LMg = slab.minMarks;  // Lower marks of the slab
  const HMg = slab.maxMarks;  // Higher marks of the slab
  
  let gradePoint: number;
  
  if (HMg === LMg) {
    gradePoint = LGPg;
  } else {
    gradePoint = LGPg + ((AM - LMg) * 0.99) / (HMg - LMg);
  }
  
  // Round to 2 decimal places and ensure GP never exceeds 10.00
  gradePoint = Math.min(Math.round(gradePoint * 100) / 100, 10.00);
  
  return { grade: slab.grade, gradePoint };
};

/**
 * Determines pass/back status based on subject type
 * - Theory: minimum GP = 4.01 (else Back Paper)
 * - Lab/Project: minimum GP = 5.01 (else Back)
 */
const getPassStatus = (type: "theory" | "lab", gradePoint: number): "pass" | "back" => {
  if (type === "theory") {
    return gradePoint >= 4.01 ? "pass" : "back";
  } else {
    return gradePoint >= 5.01 ? "pass" : "back";
  }
};

/**
 * Calculates SGPA for a semester
 * SGPA = Σ(credits × GP) / Σ(credits)
 */
const calculateSGPA = (subjects: Subject[]): number => {
  if (subjects.length === 0) return 0;
  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
  const totalPoints = subjects.reduce((sum, s) => sum + s.credits * s.gradePoint, 0);
  return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
};

/**
 * Calculates CGPA across all semesters
 * CGPA = Σ(credits × GP) / Σ(credits)
 */
const calculateCGPA = (semesters: Semester[]): number => {
  let totalCredits = 0;
  let totalPoints = 0;
  
  semesters.forEach(sem => {
    sem.subjects.forEach(sub => {
      totalCredits += sub.credits;
      totalPoints += sub.credits * sub.gradePoint;
    });
  });
  
  return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
};

// ============ UTILITY FUNCTIONS ============
const generateId = () => Math.random().toString(36).substring(2, 9);

// ============ ANIMATED COUNTER COMPONENT ============
const AnimatedNumber: React.FC<{ value: number; decimals?: number }> = ({ value, decimals = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  return <span>{displayValue.toFixed(decimals)}</span>;
};

// ============ 3D TILT CARD COMPONENT ============
const TiltCard: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = "" }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ scale: 1.02, z: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative ${className}`}
    >
      {children}
    </motion.div>
  );
};

// ============ SUBJECT CARD COMPONENT ============
const SubjectCard: React.FC<{
  subject: Subject;
  index: number;
  onUpdate: (subject: Subject) => void;
  onDelete: () => void;
}> = ({ subject, index, onUpdate, onDelete }) => {
  const updateMarks = (marks: number) => {
    const validMarks = Math.max(0, Math.min(100, marks));
    const { grade, gradePoint } = calculateGradePoint(validMarks);
    const status = getPassStatus(subject.type, gradePoint);
    onUpdate({ ...subject, marks: validMarks, grade, gradePoint, status });
  };
  
  const updateType = (type: "theory" | "lab") => {
    const status = getPassStatus(type, subject.gradePoint);
    // Labs default to 1 credit, theory stays as is or defaults to 3
    const newCredits = type === "lab" ? 1 : (subject.credits === 1 ? 3 : subject.credits);
    onUpdate({ ...subject, type, status, credits: newCredits });
  };
  
  const gradeColor = {
    O: "from-yellow-400 to-amber-500",
    E: "from-purple-400 to-violet-500",
    A: "from-green-400 to-emerald-500",
    B: "from-blue-400 to-cyan-500",
    C: "from-orange-400 to-amber-500",
    D: "from-gray-400 to-slate-500",
    F: "from-red-400 to-rose-500",
  }[subject.grade] || "from-gray-400 to-slate-500";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: -15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.8, rotateX: 15 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
      whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      className={`group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl border ${
        subject.status === "back" ? "border-red-500/50" : "border-slate-700/50"
      } p-5 overflow-hidden`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Glow Effect - pointer-events-none to not block inputs */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradeColor} opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none`} />
      
      {/* Status Badge */}
      <div className="absolute top-3 right-3 z-10">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            subject.status === "pass" 
              ? "bg-green-500/20 text-green-400 border border-green-500/30" 
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {subject.status === "pass" ? "PASS" : "BACK"}
        </motion.span>
      </div>
      
      {/* Subject Number */}
      <div className="absolute -left-2 -top-2 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg z-10 pointer-events-none">
        {index + 1}
      </div>
      
      <div className="space-y-4 mt-4 relative z-20">
        {/* Subject Name */}
        <input
          type="text"
          value={subject.name}
          onChange={(e) => onUpdate({ ...subject, name: e.target.value })}
          placeholder="Subject Name"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-lg font-medium cursor-text"
        />
        
        {/* Type and Credits Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Type</label>
            <select
              value={subject.type}
              onChange={(e) => updateType(e.target.value as "theory" | "lab")}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer"
            >
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Credits</label>
            <input
              type="number"
              value={subject.credits}
              onChange={(e) => onUpdate({ ...subject, credits: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
              min="1"
              max="10"
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2.5 text-white text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-text"
            />
          </div>
        </div>
        
        {/* Marks Input */}
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Marks (0-100)</label>
          <input
            type="number"
            value={subject.marks}
            onChange={(e) => updateMarks(parseInt(e.target.value) || 0)}
            min="0"
            max="100"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white text-center text-xl font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-text"
          />
        </div>
        
        {/* Grade Display */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <motion.div 
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradeColor} flex items-center justify-center shadow-lg`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span className="text-white font-black text-xl">{subject.grade}</span>
            </motion.div>
            <div>
              <p className="text-slate-400 text-xs">Grade Point</p>
              <p className="text-2xl font-bold text-white">{subject.gradePoint.toFixed(2)}</p>
            </div>
          </div>
          
          <button
            onClick={onDelete}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============ SGPA DISPLAY CARD ============
const SGPACard: React.FC<{ sgpa: number; totalCredits: number; passed: number; backs: number }> = ({ 
  sgpa, totalCredits, passed, backs 
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 overflow-hidden"
    style={{ transformStyle: "preserve-3d" }}
  >
    {/* Background Glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
    <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />
    
    <div className="relative z-10">
      <h3 className="text-slate-400 text-sm font-medium mb-2">Semester GPA</h3>
      <div className="flex items-baseline gap-2 mb-6">
        <motion.span 
          className="text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"
          key={sgpa}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <AnimatedNumber value={sgpa} />
        </motion.span>
        <span className="text-slate-500 text-xl">/ 10</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs">Credits</p>
          <p className="text-white font-bold text-lg">{totalCredits}</p>
        </div>
        <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
          <p className="text-green-400 text-xs">Passed</p>
          <p className="text-green-400 font-bold text-lg">{passed}</p>
        </div>
        <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20">
          <p className="text-red-400 text-xs">Backs</p>
          <p className="text-red-400 font-bold text-lg">{backs}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

// ============ SETUP SCREEN ============
const SetupScreen: React.FC<{
  onStart: (count: number, name: string) => void;
}> = ({ onStart }) => {
  const [subjectCount, setSubjectCount] = useState(6);
  const [semesterName, setSemesterName] = useState("Semester 1");
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto"
    >
      <TiltCard className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">New Semester</h2>
          <p className="text-slate-400">Enter the details to get started</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="text-slate-300 text-sm mb-2 block">Semester Name</label>
            <input
              type="text"
              value={semesterName}
              onChange={(e) => setSemesterName(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Semester 1"
            />
          </div>
          
          <div>
            <label className="text-slate-300 text-sm mb-2 block">Number of Subjects</label>
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSubjectCount(Math.max(1, subjectCount - 1))}
                className="w-12 h-12 bg-slate-700/50 rounded-xl text-white text-2xl flex items-center justify-center hover:bg-slate-600/50 transition-colors"
              >
                −
              </motion.button>
              <input
                type="number"
                value={subjectCount}
                onChange={(e) => setSubjectCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
                className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                min="1"
                max="15"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSubjectCount(Math.min(15, subjectCount + 1))}
                className="w-12 h-12 bg-slate-700/50 rounded-xl text-white text-2xl flex items-center justify-center hover:bg-slate-600/50 transition-colors"
              >
                +
              </motion.button>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -15px rgba(168, 85, 247, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStart(subjectCount, semesterName)}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg shadow-lg transition-all"
          >
            Start Calculating
          </motion.button>
        </div>
      </TiltCard>
    </motion.div>
  );
};

// ============ GRADE REFERENCE PANEL ============
const GradeReference: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5"
  >
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      IIIT-BH Grading
    </h3>
    <div className="space-y-2 text-sm">
      {GRADE_SLABS.map(slab => (
        <div key={slab.grade} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
              slab.grade === "O" ? "bg-yellow-500" :
              slab.grade === "E" ? "bg-purple-500" :
              slab.grade === "A" ? "bg-green-500" :
              slab.grade === "B" ? "bg-blue-500" :
              slab.grade === "C" ? "bg-orange-500" :
              slab.grade === "D" ? "bg-gray-500" : "bg-red-500"
            }`}>{slab.grade}</span>
            <span className="text-slate-400">{slab.minMarks}-{slab.maxMarks}</span>
          </div>
          <span className="text-slate-300 font-mono">{slab.minGP.toFixed(2)}-{slab.maxGP.toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs text-slate-400">
      <p><span className="text-purple-400">*</span> Marks &gt; 95 capped at 95</p>
      <p><span className="text-green-400">Theory Pass:</span> GP ≥ 4.01</p>
      <p><span className="text-blue-400">Lab Pass:</span> GP ≥ 5.01</p>
    </div>
  </motion.div>
);

// ============ MAIN COMPONENT ============
const GradeFlow: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"setup" | "input">("setup");
  const [currentSubjects, setCurrentSubjects] = useState<Subject[]>([]);
  const [currentSemesterName, setCurrentSemesterName] = useState("");
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Persist semesters to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
  }, [semesters]);
  
  const startNewSemester = (count: number, name: string) => {
    const subjects: Subject[] = Array.from({ length: count }, (_, i) => {
      const { grade, gradePoint } = calculateGradePoint(0);
      return {
        id: generateId(),
        name: `Subject ${i + 1}`,
        type: "theory" as const,
        credits: 3,
        marks: 0,
        gradePoint,
        grade,
        status: "back" as const,
      };
    });
    setCurrentSubjects(subjects);
    setCurrentSemesterName(name);
    setStep("input");
  };
  
  const updateSubject = (index: number, subject: Subject) => {
    setCurrentSubjects(prev => {
      const updated = [...prev];
      updated[index] = subject;
      return updated;
    });
  };
  
  const deleteSubject = (index: number) => {
    setCurrentSubjects(prev => prev.filter((_, i) => i !== index));
  };
  
  const addSubject = () => {
    const { grade, gradePoint } = calculateGradePoint(0);
    const newSubject: Subject = {
      id: generateId(),
      name: `Subject ${currentSubjects.length + 1}`,
      type: "theory",
      credits: 3,
      marks: 0,
      gradePoint,
      grade,
      status: "back",
    };
    setCurrentSubjects(prev => [...prev, newSubject]);
  };
  
  const saveSemester = () => {
    const sgpa = calculateSGPA(currentSubjects);
    const totalCredits = currentSubjects.reduce((sum, s) => sum + s.credits, 0);
    const passedSubjects = currentSubjects.filter(s => s.status === "pass").length;
    const backSubjects = currentSubjects.filter(s => s.status === "back").length;
    
    if (editingSemesterId) {
      // Update existing semester
      setSemesters(prev => prev.map(sem => 
        sem.id === editingSemesterId 
          ? {
              ...sem,
              name: currentSemesterName,
              subjects: currentSubjects,
              sgpa,
              totalCredits,
              passedSubjects,
              backSubjects,
            }
          : sem
      ));
      setEditingSemesterId(null);
    } else {
      // Create new semester
      const semester: Semester = {
        id: generateId(),
        name: currentSemesterName,
        subjects: currentSubjects,
        sgpa,
        totalCredits,
        passedSubjects,
        backSubjects,
      };
      
      setSemesters(prev => [...prev, semester]);
    }
    
    setStep("setup");
    setCurrentSubjects([]);
  };
  
  const editSemester = (semester: Semester) => {
    setCurrentSubjects([...semester.subjects]);
    setCurrentSemesterName(semester.name);
    setEditingSemesterId(semester.id);
    setStep("input");
  };
  
  const deleteSemester = (id: string) => {
    setSemesters(prev => prev.filter(s => s.id !== id));
  };
  
  const resetAll = () => {
    if (confirm("Are you sure you want to reset all data?")) {
      setSemesters([]);
      setCurrentSubjects([]);
      setEditingSemesterId(null);
      setStep("setup");
    }
  };
  
  const currentSGPA = calculateSGPA(currentSubjects);
  const cgpa = calculateCGPA(semesters);
  const totalCredits = currentSubjects.reduce((sum, s) => sum + s.credits, 0);
  const passedSubjects = currentSubjects.filter(s => s.status === "pass").length;
  const backSubjects = currentSubjects.filter(s => s.status === "back").length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            x: [0, 100, 0], 
            y: [0, -50, 0],
            scale: [1, 1.2, 1] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 0], 
            y: [0, 50, 0],
            scale: [1, 1.3, 1] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            x: [0, 50, 0], 
            y: [0, 100, 0] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" 
        />
      </div>
      
      {/* Header */}
      <header className="relative z-10 border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/")}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </motion.button>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                GradeFlow
              </h1>
              <p className="text-slate-400 text-xs">IIIT Bhubaneswar Grading System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {semesters.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                <span className="text-slate-400 text-sm">CGPA:</span>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {cgpa.toFixed(2)}
                </span>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetAll}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-colors text-sm"
            >
              Reset
            </motion.button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Previous Semesters */}
              {semesters.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Previous Semesters</h2>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                      <span className="text-slate-400 text-sm">Overall CGPA:</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        <AnimatedNumber value={cgpa} />
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {semesters.map((sem, index) => (
                      <motion.div
                        key={sem.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -5, boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.3)" }}
                        onClick={() => editSemester(sem)}
                        className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5 group cursor-pointer"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSemester(sem.id);
                          }}
                          className="absolute top-3 right-3 p-1.5 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
                        {/* Edit Icon */}
                        <div className="absolute top-3 right-10 p-1.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        
                        <h3 className="text-white font-semibold mb-3">{sem.name}</h3>
                        <div className="flex items-baseline gap-2 mb-4">
                          <span className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {sem.sgpa.toFixed(2)}
                          </span>
                          <span className="text-slate-500">SGPA</span>
                        </div>
                        <div className="flex gap-3 text-sm">
                          <span className="text-slate-400">{sem.totalCredits} credits</span>
                          <span className="text-green-400">{sem.passedSubjects} passed</span>
                          {sem.backSubjects > 0 && (
                            <span className="text-red-400">{sem.backSubjects} backs</span>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs mt-3 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* New Semester Setup */}
              <SetupScreen onStart={startNewSemester} />
            </motion.div>
          )}
          
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Semester Header */}
              <div className="flex items-center justify-between">
                <div>
                  <motion.button
                    whileHover={{ x: -5 }}
                    onClick={() => {
                      setStep("setup");
                      setEditingSemesterId(null);
                      setCurrentSubjects([]);
                    }}
                    className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </motion.button>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={currentSemesterName}
                      onChange={(e) => setCurrentSemesterName(e.target.value)}
                      className="text-2xl font-bold text-white bg-transparent border-b-2 border-transparent hover:border-slate-600 focus:border-purple-500 focus:outline-none transition-colors"
                      placeholder="Semester Name"
                    />
                    {editingSemesterId && (
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30">
                        Editing
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400">{currentSubjects.length} subjects</p>
                </div>
                
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addSubject}
                    className="px-4 py-2 bg-slate-700/50 text-white rounded-xl hover:bg-slate-600/50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Subject
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -15px rgba(168, 85, 247, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={saveSemester}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg"
                  >
                    {editingSemesterId ? "Update Semester" : "Save Semester"}
                  </motion.button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Subject Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {currentSubjects.map((subject, index) => (
                      <SubjectCard
                        key={subject.id}
                        subject={subject}
                        index={index}
                        onUpdate={(s) => updateSubject(index, s)}
                        onDelete={() => deleteSubject(index)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-4">
                  <SGPACard 
                    sgpa={currentSGPA} 
                    totalCredits={totalCredits}
                    passed={passedSubjects}
                    backs={backSubjects}
                  />
                  <GradeReference />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-700/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-slate-500 text-sm">
            GradeFlow • IIIT Bhubaneswar Continuous Grading System
          </p>
          <p className="text-slate-600 text-xs mt-1">
            GP = LGPg + ((AM − LMg) × 0.99) / (HMg − LMg)
          </p>
        </div>
      </footer>
    </div>
  );
};

export default GradeFlow;
