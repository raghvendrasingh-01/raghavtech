# ⌨️ Typing Speed Test

A clean, minimal typing speed test web app inspired by [keybr.com](https://keybr.com) and [monkeytype.com](https://monkeytype.com). Built with pure HTML, CSS, and JavaScript — no frameworks or dependencies.

![Typing Speed Test Preview](preview.png)

## ✨ Features

- **Clean UI**: Distraction-free, minimal design with soft colors
- **Real-time Feedback**: Characters highlight green (correct) or red (incorrect) as you type
- **Live Statistics**: WPM and accuracy update in real-time
- **Caret Cursor**: Blinking cursor indicates current typing position
- **Focus Mode**: UI elements fade while typing for better concentration
- **60-Second Timer**: Starts on first keypress
- **Result Summary**: Shows final WPM, accuracy, and characters typed
- **Mobile Responsive**: Works on all screen sizes
- **Keyboard Shortcuts**: Press `Escape` to restart anytime

## 🚀 Getting Started

### Option 1: Open Directly
Simply open `index.html` in any modern web browser.

### Option 2: Use a Local Server
```bash
# Using Python
python -m http.server 8080

# Using Node.js (if http-server is installed)
npx http-server

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## 📁 Project Structure

```
typing-speed-test/
├── index.html      # Main HTML structure
├── style.css       # All styling (CSS variables, responsive design)
├── script.js       # Game logic (ES6 JavaScript)
└── README.md       # This file
```

## 🎮 How to Use

1. **Start Typing**: Click on the input field and start typing the displayed paragraph
2. **Timer Begins**: The 60-second countdown starts on your first keypress
3. **Watch Your Stats**: WPM and accuracy update as you type
4. **Complete or Wait**: Finish the paragraph or wait for the timer to end
5. **View Results**: See your final statistics in the result modal
6. **Restart**: Click "Try Again" or press `Escape` to restart

## 📊 Statistics Explained

### WPM (Words Per Minute)
```
WPM = (Correct Characters ÷ 5) ÷ Minutes Elapsed
```
- Standard word length is 5 characters
- Only correctly typed characters count

### Accuracy
```
Accuracy = (Correct Characters ÷ Total Characters Typed) × 100
```
- Measures typing precision
- Errors reduce your accuracy percentage

## 🎨 Customization

### Change Timer Duration
In `script.js`, modify the `timeLeft` variable:
```javascript
let timeLeft = 60;  // Change to 30, 120, etc.
```

### Add More Paragraphs
In `script.js`, add to the `paragraphs` array:
```javascript
const paragraphs = [
  "Your new paragraph here...",
  // ... existing paragraphs
];
```

### Modify Colors
In `style.css`, update the CSS variables:
```css
:root {
  --accent-primary: #5a67d8;    /* Main accent color */
  --correct-color: #48bb78;      /* Correct character color */
  --incorrect-color: #f56565;    /* Incorrect character color */
  /* ... other variables */
}
```

## 🔧 Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Flexbox, CSS Variables, Animations
- **JavaScript (ES6)**: Modern syntax, DOM manipulation

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Key Features Implementation

1. **Character Highlighting**: Each character is wrapped in a `<span>` element and dynamically styled based on typing accuracy.

2. **Caret Animation**: CSS `::before` pseudo-element with `@keyframes` animation creates the blinking cursor effect.

3. **Focus Mode**: When typing begins, `document.body` receives a class that fades non-essential UI elements.

4. **Real-time Updates**: Statistics are recalculated on every `input` event and every second via `setInterval`.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to fork this project and make improvements:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with ❤️ for learning and portfolio purposes.
