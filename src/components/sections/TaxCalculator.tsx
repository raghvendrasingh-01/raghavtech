import { StarsCanvas } from "../canvas";

const TaxCalculator = () => {
  return (
    <div className="relative min-h-screen w-full bg-black">
      <StarsCanvas />
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-5xl font-bold mb-4">Tax Calculator</h1>
          <p className="text-secondary text-xl">Coming Soon</p>
        </div>
      </div>
    </div>
  );
};

export default TaxCalculator;
