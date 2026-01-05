import { BrowserRouter, Routes, Route } from "react-router-dom";

import {
  About,
  Contact,
  Hero,
  Navbar,
  Tech,
  Works,
  StarsCanvas,
} from "./components";
import { useEffect } from "react";
import { config } from "./constants/config";
import TaxCalculator from "./pages/TaxCalculator";
import Speed from "./pages/Speed";
import StudyPlanner from "./pages/StudyPlanner";
import GradeFlow from "./pages/GradeFlow";

const App = () => {
  useEffect(() => {
    if (document.title !== config.html.title) {
      document.title = config.html.title;
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="bg-primary relative z-0">
            <div className="bg-hero-pattern bg-cover bg-center bg-no-repeat">
              <Navbar />
              <Hero />
            </div>
            <About />
            <Tech />
            <Works />
            <div className="relative z-0">
              <Contact />
              <StarsCanvas />
            </div>
          </div>
        } />
        <Route path="/tax-calculator" element={<TaxCalculator />} />
        <Route path="/speed" element={<Speed />} />
        <Route path="/study-planner" element={<StudyPlanner />} />
        <Route path="/grade-flow" element={<GradeFlow />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
