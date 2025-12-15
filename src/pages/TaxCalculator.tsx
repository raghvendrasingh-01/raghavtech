import { useState } from "react";
import { StarsCanvas } from "../components/canvas";

const TaxCalculator = () => {
  const [income, setIncome] = useState<string>("");
  const [regime, setRegime] = useState<string>("1");
  const [result, setResult] = useState<string>("");

  const calculateOldRegime = (income: number): { tax: number; taxable: number } => {
    let tax = 0;
    const taxable = income - 50000; // Standard deduction

    if (taxable <= 250000) {
      tax = 0;
    } else if (taxable <= 500000) {
      tax = (taxable - 250000) * 0.05;
    } else if (taxable <= 1000000) {
      tax = 12500 + (taxable - 500000) * 0.2;
    } else {
      tax = 112500 + (taxable - 1000000) * 0.3;
    }

    // Rebate under Section 87A
    if (taxable <= 500000) {
      tax = 0;
    }

    return { tax, taxable };
  };

  const calculateNewRegime = (income: number): { tax: number; taxable: number } => {
    let tax = 0;
    const taxable = income - 75000; // Standard deduction

    if (taxable <= 400000) {
      tax = 0;
    } else if (taxable <= 800000) {
      tax = (taxable - 400000) * 0.05;
    } else if (taxable <= 1200000) {
      tax = 20000 + (taxable - 800000) * 0.1;
    } else if (taxable <= 1600000) {
      tax = 60000 + (taxable - 1200000) * 0.15;
    } else if (taxable <= 2000000) {
      tax = 120000 + (taxable - 1600000) * 0.2;
    } else if (taxable <= 2400000) {
      tax = 200000 + (taxable - 2000000) * 0.25;
    } else {
      tax = 300000 + (taxable - 2400000) * 0.3;
    }

    // Rebate under Section 87A
    if (taxable <= 1200000) {
      tax = 0;
    }

    return { tax, taxable };
  };

  const calculateCess = (tax: number): number => {
    return tax * 0.04; // 4% Health and Education Cess
  };

  const handleCalculate = () => {
    const incomeValue = parseFloat(income);

    if (isNaN(incomeValue) || incomeValue < 0) {
      setResult("Please enter a valid income amount.");
      return;
    }

    let tax = 0;
    let taxable = 0;
    let standardDeduction = 0;
    let regimeName = "";
    let rebateInfo = "";

    if (regime === "1") {
      const result = calculateOldRegime(incomeValue);
      tax = result.tax;
      taxable = result.taxable;
      standardDeduction = 50000;
      regimeName = "OLD REGIME";
      
      if (taxable <= 500000) {
        rebateInfo = "* You are eligible for tax rebate under Section 87A\n* Income up to Rs. 5.5 Lakhs - 0 Tax";
      }
    } else {
      const result = calculateNewRegime(incomeValue);
      tax = result.tax;
      taxable = result.taxable;
      standardDeduction = 75000;
      regimeName = "NEW REGIME";
      
      if (taxable <= 1200000) {
        rebateInfo = "* You are eligible for tax rebate under Section 87A\n* Income up to Rs. 12.75 Lakhs - 0 Tax";
      }
    }

    const cess = calculateCess(tax);
    const totalTax = tax + cess;

    const output = `=====================================
        Tax Calculation Summary      
=====================================

Regime: ${regimeName}
Standard Deduction: Rs. ${standardDeduction.toLocaleString('en-IN')}
Taxable Income: Rs. ${taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}

Income Tax: Rs. ${tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
Health & Education Cess (4%): Rs. ${cess.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
-------------------------------------
Total Tax Liability: Rs. ${totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}

${rebateInfo}

=====================================
Note: Calculations exclude surcharge
=====================================`;

    setResult(output);
  };

  return (
    <div className="relative min-h-screen w-full bg-black">
      <StarsCanvas />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-20">
        <div className="w-full max-w-2xl">
          <h1 className="text-white text-4xl font-bold text-center mb-8">
            Income Tax Calculator FY 25-26
          </h1>

          <div className="bg-tertiary rounded-2xl p-8 shadow-xl">
            <div className="mb-6">
              <label className="text-white block mb-2 text-lg">
                Enter your annual income (Rs):
              </label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-primary text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                placeholder="e.g., 1000000"
              />
            </div>

            <div className="mb-6">
              <label className="text-white block mb-3 text-lg">
                Select Tax Regime:
              </label>
              <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="1"
                    checked={regime === "1"}
                    onChange={(e) => setRegime(e.target.value)}
                    className="w-5 h-5 mr-3"
                  />
                  <span className="text-white text-base">Old Regime</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="2"
                    checked={regime === "2"}
                    onChange={(e) => setRegime(e.target.value)}
                    className="w-5 h-5 mr-3"
                  />
                  <span className="text-white text-base">New Regime</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Calculate Tax
            </button>

            {result && (
              <div className="mt-6">
                <pre className="bg-primary text-green-400 p-6 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                  {result}
                </pre>
              </div>
            )}
          </div>

          {/* Code Section */}
          <div className="bg-tertiary rounded-2xl p-8 shadow-xl mt-8">
            <h2 className="text-white text-2xl font-bold mb-4">Source Code</h2>
            <pre className="bg-primary text-gray-300 p-6 rounded-lg overflow-x-auto text-xs font-mono">
{`#include <stdio.h>

double calculate_old_regime(double income) {
    double tax = 0;
    double taxable = income - 50000; // Standard deduction
    
    if (taxable <= 250000) {
        tax = 0;
    } else if (taxable <= 500000) {
        tax = (taxable - 250000) * 0.05;
    } else if (taxable <= 1000000) {
        tax = 12500 + (taxable - 500000) * 0.20;
    } else {
        tax = 112500 + (taxable - 1000000) * 0.30;
    }
    
    // Rebate under Section 87A
    if (taxable <= 500000) {
        tax = 0;
    }
    
    return tax;
}

double calculate_new_regime(double income) {
    double tax = 0;
    double taxable = income - 75000; // Standard deduction
    
    if (taxable <= 400000) {
        tax = 0;
    } else if (taxable <= 800000) {
        tax = (taxable - 400000) * 0.05;
    } else if (taxable <= 1200000) {
        tax = 20000 + (taxable - 800000) * 0.10;
    } else if (taxable <= 1600000) {
        tax = 60000 + (taxable - 1200000) * 0.15;
    } else if (taxable <= 2000000) {
        tax = 120000 + (taxable - 1600000) * 0.20;
    } else if (taxable <= 2400000) {
        tax = 200000 + (taxable - 2000000) * 0.25;
    } else {
        tax = 300000 + (taxable - 2400000) * 0.30;
    }
    
    // Rebate under Section 87A
    if (taxable <= 1200000) {
        tax = 0;
    }
    
    return tax;
}

double calculate_cess(double tax) {
    return tax * 0.04; // 4% Health and Education Cess 
}

int main() {
    double income;
    int regime;
    
    printf("=====================================\\n");
    printf("   Income Tax Calculator FY 25-26   \\n");
    printf("=====================================\\n\\n");
    
    printf("Enter your annual income (Rs): ");
    scanf("%lf", &income);
    
    printf("\\nSelect Tax Regime:\\n");
    printf("1. Old Regime\\n");
    printf("2. New Regime\\n");
    printf("Enter your choice (1 or 2): ");
    scanf("%d", &regime);
    
    double tax = 0;
    double cess = 0;
    double total_tax = 0;
    
    printf("\\n=====================================\\n");
    printf("        Tax Calculation Summary      \\n");
    printf("=====================================\\n\\n");
    
    if (regime == 1) {
        printf("Regime: OLD REGIME\\n");
        printf("Standard Deduction: Rs. 50,000\\n");
        printf("Taxable Income: Rs. %.2lf\\n\\n", income - 50000);
        
        tax = calculate_old_regime(income);
        cess = calculate_cess(tax);
        total_tax = tax + cess;
        
        printf("Income Tax: Rs. %.2lf\\n", tax);
        printf("Health & Education Cess (4%%): Rs. %.2lf\\n", cess);
        printf("-------------------------------------\\n");
        printf("Total Tax Liability: Rs. %.2lf\\n", total_tax);
        
        if (income - 50000 <= 500000) {
            printf("\\n* You are eligible for tax rebate under Section 87A\\n");
            printf("* Income up to Rs. 5.5 Lakhs - 0 Tax\\n");
        }
    } 
    else if (regime == 2) {
        printf("Regime: NEW REGIME\\n");
        printf("Standard Deduction: Rs. 75,000\\n");
        printf("Taxable Income: Rs. %.2lf\\n\\n", income - 75000);
        
        tax = calculate_new_regime(income);
        cess = calculate_cess(tax);
        total_tax = tax + cess;
        
        printf("Income Tax: Rs. %.2lf\\n", tax);
        printf("Health & Education Cess (4%%): Rs. %.2lf\\n", cess);
        printf("-------------------------------------\\n");
        printf("Total Tax Liability: Rs. %.2lf\\n", total_tax);
        
        if (income - 75000 <= 1200000) {
            printf("\\n* You are eligible for tax rebate under Section 87A\\n");
            printf("* Income up to Rs. 12.75 Lakhs - 0 Tax\\n");
        }
    } 
    else {
        printf("Invalid choice!\\n");
        return 1;
    }
    
    printf("\\n=====================================\\n");
    printf("Note: Calculations exclude surcharge\\n");
    printf("=====================================\\n");
    
    return 0;
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxCalculator;
