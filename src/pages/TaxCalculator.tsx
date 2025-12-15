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

          {/* Working Information Section */}
          <div className="bg-tertiary rounded-2xl p-8 shadow-xl mt-8">
            <h2 className="text-white text-3xl font-bold mb-6">How It Works</h2>
            
            <div className="text-gray-300 space-y-6">
              <p className="text-lg">
                The program helps users calculate their income tax liability by choosing between two different tax calculation methods available in India.
              </p>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Two Tax Regimes:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-purple-400">Old Regime:</strong> Lower standard deduction but allows various exemptions and deductions</li>
                  <li><strong className="text-purple-400">New Regime:</strong> Higher standard deduction but no exemptions allowed</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Standard Deduction:</h3>
                <p>Amount automatically subtracted from income before tax calculation:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Old Regime: ₹50,000</li>
                  <li>New Regime: ₹75,000</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Section 87A Rebate:</h3>
                <p>Special benefit for low-income taxpayers:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Old Regime: No tax up to ₹5.5 lakhs</li>
                  <li>New Regime: No tax up to ₹12.75 lakhs</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Old Regime Tax Slabs:</h3>
                <div className="bg-primary rounded-lg p-4">
                  <ul className="space-y-2">
                    <li>Up to ₹2.5 lakhs: <span className="text-green-400">0%</span></li>
                    <li>₹2.5L to ₹5L: <span className="text-yellow-400">5%</span></li>
                    <li>₹5L to ₹10L: <span className="text-orange-400">20%</span></li>
                    <li>Above ₹10L: <span className="text-red-400">30%</span></li>
                  </ul>
                  <p className="mt-3 text-sm text-gray-400">Standard Deduction: ₹50,000</p>
                </div>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">New Regime Tax Slabs:</h3>
                <div className="bg-primary rounded-lg p-4">
                  <ul className="space-y-2">
                    <li>Up to ₹4 lakhs: <span className="text-green-400">0%</span></li>
                    <li>₹4L to ₹8L: <span className="text-green-300">5%</span></li>
                    <li>₹8L to ₹12L: <span className="text-yellow-400">10%</span></li>
                    <li>₹12L to ₹16L: <span className="text-yellow-300">15%</span></li>
                    <li>₹16L to ₹20L: <span className="text-orange-400">20%</span></li>
                    <li>₹20L to ₹24L: <span className="text-orange-300">25%</span></li>
                    <li>Above ₹24L: <span className="text-red-400">30%</span></li>
                  </ul>
                  <p className="mt-3 text-sm text-gray-400">Standard Deduction: ₹75,000</p>
                </div>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Example Calculation:</h3>
                <p className="mb-2">For ₹10,00,000 income under New Regime:</p>
                <div className="bg-primary rounded-lg p-4 font-mono text-sm">
                  <pre className="whitespace-pre-wrap">
{`Gross Income:           ₹10,00,000
Standard Deduction:     -   ₹75,000
Taxable Income:         ₹9,25,000

Tax Calculation:
₹0 to ₹4L:      ₹0      (0%)
₹4L to ₹8L:     ₹20,000 (5% of ₹4L)
₹8L to ₹9.25L:  ₹12,500 (10% of ₹1.25L)

Base Tax:       ₹32,500
Less: Rebate:   -₹32,500 (under Section 87A)
Tax:            ₹0
Cess (4%):      ₹0

Total Tax:      ₹0`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Tax Comparison Table:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full bg-primary rounded-lg">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="p-3 text-left">Income (₹)</th>
                        <th className="p-3 text-left">Old Regime Tax</th>
                        <th className="p-3 text-left">New Regime Tax</th>
                        <th className="p-3 text-left">Better Choice</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-800">
                        <td className="p-3">5,00,000</td>
                        <td className="p-3">0</td>
                        <td className="p-3">0</td>
                        <td className="p-3 text-yellow-400">Both Same</td>
                      </tr>
                      <tr className="border-b border-gray-800">
                        <td className="p-3">8,00,000</td>
                        <td className="p-3">36,400</td>
                        <td className="p-3">0</td>
                        <td className="p-3 text-green-400">New Regime</td>
                      </tr>
                      <tr className="border-b border-gray-800">
                        <td className="p-3">10,00,000</td>
                        <td className="p-3">88,400</td>
                        <td className="p-3">0</td>
                        <td className="p-3 text-green-400">New Regime</td>
                      </tr>
                      <tr className="border-b border-gray-800">
                        <td className="p-3">15,00,000</td>
                        <td className="p-3">2,38,400</td>
                        <td className="p-3">78,000</td>
                        <td className="p-3 text-green-400">New Regime</td>
                      </tr>
                      <tr>
                        <td className="p-3">20,00,000</td>
                        <td className="p-3">3,88,400</td>
                        <td className="p-3">1,82,000</td>
                        <td className="p-3 text-green-400">New Regime</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">When to Choose Old Regime:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>If you have large deductions (80C, 80D, HRA, etc.)</li>
                  <li>If your total deductions exceed the tax benefit of New Regime</li>
                  <li>Generally better for income with many investments</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">When to Choose New Regime:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>If you have minimal or no deductions</li>
                  <li>For income up to ₹12.75 lakhs (zero tax)</li>
                  <li>Simpler calculation with higher exemption limit</li>
                  <li>Better for most salaried employees without investments</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Key Features:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Interactive Input: User enters their income and selects preferred regime</li>
                  <li>Automatic Calculations: Program handles all tax slab calculations</li>
                  <li>Rebate Application: Automatically applies Section 87A benefits</li>
                  <li>Cess Inclusion: Adds 4% Health and Education Cess</li>
                  <li>Clear Summary: Shows breakdown of all tax components</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-xl font-bold mb-3">Limitations:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4 text-gray-400">
                  <li>Does not calculate surcharge (for very high income)</li>
                  <li>Assumes no other deductions in Old Regime</li>
                  <li>Simplified calculation for educational purposes</li>
                  <li>Does not handle TDS (Tax Deducted at Source)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxCalculator;
