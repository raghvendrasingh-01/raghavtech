// ========================
// Typing Speed Test - Main Script
// ========================

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

// DOM Elements
const textContent = document.getElementById('textContent');
const inputField = document.getElementById('inputField');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const restartBtn = document.getElementById('restartBtn');
const buttonRow = document.getElementById('buttonRow');
const textDisplay = document.getElementById('textDisplay');
const resultModal = document.getElementById('resultModal');
const finalWpm = document.getElementById('finalWpm');
const finalAccuracy = document.getElementById('finalAccuracy');
const finalChars = document.getElementById('finalChars');
const tryAgainBtn = document.getElementById('tryAgainBtn');

// Game State
let currentParagraph = '';
let timeLeft = 60;
let timer = null;
let isStarted = false;
let isFinished = false;
let correctChars = 0;
let totalTyped = 0;
let startTime = null;

// ========================
// Initialize Game
// ========================
function init() {
  // Reset state
  isStarted = false;
  isFinished = false;
  timeLeft = 60;
  correctChars = 0;
  totalTyped = 0;
  startTime = null;
  
  // Clear any existing timer
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  // Get random paragraph
  currentParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
  
  // Render paragraph with character spans
  renderParagraph();
  
  // Reset displays
  timerDisplay.textContent = '60';
  wpmDisplay.textContent = '0';
  accuracyDisplay.textContent = '100';
  
  // Reset input
  inputField.value = '';
  inputField.disabled = false;
  inputField.focus();
  
  // Reset UI
  textDisplay.classList.remove('active');
  document.body.classList.remove('typing-mode');
  resultModal.classList.remove('show');
}

// ========================
// Render Paragraph
// ========================
function renderParagraph() {
  textContent.innerHTML = '';
  
  currentParagraph.split('').forEach((char, index) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    span.dataset.index = index;
    
    // Mark first character as current
    if (index === 0) {
      span.classList.add('current');
    }
    
    textContent.appendChild(span);
  });
}

// ========================
// Start Timer
// ========================
function startTimer() {
  if (isStarted) return;
  
  isStarted = true;
  startTime = Date.now();
  textDisplay.classList.add('active');
  document.body.classList.add('typing-mode');
  
  timer = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    
    // Update WPM in real-time
    updateStats();
    
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// ========================
// Handle Input
// ========================
function handleInput(e) {
  if (isFinished) return;
  
  // Start timer on first keypress
  if (!isStarted) {
    startTimer();
  }
  
  const typedText = inputField.value;
  const chars = textContent.querySelectorAll('.char');
  
  // Reset all character styles
  chars.forEach(char => {
    char.classList.remove('correct', 'incorrect', 'current');
  });
  
  // Track correct characters for this update
  let currentCorrect = 0;
  
  // Apply styles based on typed text
  typedText.split('').forEach((char, index) => {
    if (index < chars.length) {
      if (char === currentParagraph[index]) {
        chars[index].classList.add('correct');
        currentCorrect++;
      } else {
        chars[index].classList.add('incorrect');
      }
    }
  });
  
  // Mark current position
  if (typedText.length < chars.length) {
    chars[typedText.length].classList.add('current');
  }
  
  // Update counters
  correctChars = currentCorrect;
  totalTyped = typedText.length;
  
  // Update stats display
  updateStats();
  
  // Check if completed
  if (typedText.length >= currentParagraph.length) {
    endGame();
  }
}

// ========================
// Update Statistics
// ========================
function updateStats() {
  // Calculate time elapsed in minutes
  const timeElapsed = isStarted ? (60 - timeLeft) / 60 : 0;
  
  // Calculate WPM (words = characters / 5)
  let wpm = 0;
  if (timeElapsed > 0) {
    wpm = Math.round((correctChars / 5) / timeElapsed);
  }
  
  // Calculate accuracy
  let accuracy = 100;
  if (totalTyped > 0) {
    accuracy = Math.round((correctChars / totalTyped) * 100);
  }
  
  // Update displays
  wpmDisplay.textContent = wpm;
  accuracyDisplay.textContent = accuracy;
}

// ========================
// End Game
// ========================
function endGame() {
  isFinished = true;
  
  // Stop timer
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  // Disable input
  inputField.disabled = true;
  textDisplay.classList.remove('active');
  document.body.classList.remove('typing-mode');
  
  // Calculate final stats
  const timeElapsed = (60 - timeLeft) / 60 || 1/60; // Avoid division by zero
  const finalWpmValue = Math.round((correctChars / 5) / timeElapsed);
  const finalAccuracyValue = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;
  
  // Update result modal
  finalWpm.textContent = finalWpmValue;
  finalAccuracy.textContent = finalAccuracyValue + '%';
  finalChars.textContent = correctChars;
  
  // Show result modal
  setTimeout(() => {
    resultModal.classList.add('show');
  }, 300);
}

// ========================
// Event Listeners
// ========================

// Input event for typing
inputField.addEventListener('input', handleInput);

// Prevent paste
inputField.addEventListener('paste', (e) => {
  e.preventDefault();
});

// Restart button
restartBtn.addEventListener('click', init);

// Try again button in result modal
tryAgainBtn.addEventListener('click', () => {
  resultModal.classList.remove('show');
  setTimeout(init, 300);
});

// Keyboard shortcut to restart (Tab + Enter)
document.addEventListener('keydown', (e) => {
  // Escape to restart
  if (e.key === 'Escape') {
    init();
  }
  
  // Tab to focus input
  if (e.key === 'Tab' && !isFinished) {
    e.preventDefault();
    inputField.focus();
  }
});

// Keep focus on input field
document.addEventListener('click', (e) => {
  if (!isFinished && !e.target.closest('.btn')) {
    inputField.focus();
  }
});

// ========================
// Initialize on Load
// ========================
document.addEventListener('DOMContentLoaded', init);
