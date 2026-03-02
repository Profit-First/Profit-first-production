/**
 * Business Expenses Component
 * 
 * PURPOSE: Manage additional business expenses for accurate profit calculations
 * 
 * EXPENSE CATEGORIES:
 * 1. Agency Fees - Marketing agency costs
 * 2. RTO Handling Fees - Return processing costs
 * 3. Payment Gateway Fees - Transaction processing fees (% of revenue)
 * 4. Staff Fees - Employee salaries
 * 5. Office Rent - Operational overhead
 * 6. Other Expenses - Miscellaneous costs
 * 
 * IMPACT: These expenses are deducted from Net Profit calculation
 * Updated Formula: Net Profit = Revenue - (COGS + Ad Spend + Shipping + Business Expenses)
 */

import React, { useState, useEffect } from "react";
import axiosInstance from "../../axios";
import { toast } from "react-toastify";
import { PulseLoader } from "react-spinners";
import { FiSave, FiDollarSign, FiTrendingDown, FiInfo } from "react-icons/fi";

const BusinessExpenses = () => {
  const [expenses, setExpenses] = useState({
    agencyFees: 0,
    rtoHandlingFees: 0,
    paymentGatewayFeePercent: 2.5, // Default 2.5%
    staffFees: 0,
    officeRent: 0,
    otherExpenses: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing expenses on component mount
  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await axiosInstance.get("/user/business-expenses");
      if (response.data.expenses) {
        setExpenses(response.data.expenses);
      }
    } catch (error) {
      console.error("Error fetching business expenses:", error);
      // Don't show error toast for first time users (404 is expected)
      if (error.response?.status !== 404) {
        toast.error("Failed to load business expenses");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    // Convert to number and ensure non-negative
    const numValue = Math.max(0, parseFloat(value) || 0);
    
    setExpenses(prev => ({
      ...prev,
      [field]: numValue
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axiosInstance.post("/user/business-expenses", { expenses });
      toast.success("Business expenses saved successfully!");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving business expenses:", error);
      toast.error("Failed to save business expenses");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate total monthly expenses
  const totalMonthlyExpenses = Object.values(expenses).reduce((sum, value) => {
    // Exclude percentage-based fees from monthly total
    if (typeof value === 'number') {
      return sum + value;
    }
    return sum;
  }, 0) - expenses.paymentGatewayFeePercent; // Subtract percentage as it's not a fixed amount

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="p-6 text-white space-y-6 bg-[#0D1D1E] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Business Expenses</h2>
          <p className="text-gray-400 mt-1">
            Configure additional business expenses for accurate profit calculations
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges && !isSaving
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSaving ? (
            <PulseLoader size={8} color="#ffffff" />
          ) : (
            <FiSave className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-400 font-medium mb-1">How This Affects Your Profits</h3>
            <p className="text-gray-300 text-sm">
              These expenses will be automatically deducted from your Net Profit calculations in the dashboard. 
              This gives you a more accurate picture of your actual business profitability.
            </p>
          </div>
        </div>
      </div>

      {/* Expense Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Marketing Expenses */}
        <div className="bg-[#161616] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 text-green-400" />
            Marketing Expenses
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agency Fees (Monthly)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={expenses.agencyFees}
                  onChange={(e) => handleInputChange('agencyFees', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Monthly fees paid to marketing agencies or consultants
              </p>
            </div>
          </div>
        </div>

          {/* Other Expenses */}
        <div className="bg-[#161616] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 text-gray-400" />
            Other Expenses
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Other Expenses (Monthly)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={expenses.otherExpenses}
                  onChange={(e) => handleInputChange('otherExpenses', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Miscellaneous business expenses (software, tools, etc.)
              </p>
            </div>
          </div>
        </div>
      </div>

        {/* Operational Expenses */}
        <div className="bg-[#161616] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiTrendingDown className="w-5 h-5 text-orange-400" />
            Operational Expenses
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                RTO Handling Fees (Monthly)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={expenses.rtoHandlingFees}
                  onChange={(e) => handleInputChange('rtoHandlingFees', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Costs for processing returned orders (RTO)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Payment Gateway Fees (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={expenses.paymentGatewayFeePercent}
                  onChange={(e) => handleInputChange('paymentGatewayFeePercent', e.target.value)}
                  className="w-full pl-4 pr-8 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="2.5"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Percentage fee charged by payment processors (Razorpay, PayU, etc.)
              </p>
            </div>
          </div>
        </div>



        {/* Staff & Office Expenses */}
        <div className="bg-[#161616] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 text-purple-400" />
      
            Staff & Office
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Staff Fees (Monthly)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={expenses.staffFees}
                  onChange={(e) => handleInputChange('staffFees', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total monthly salaries and employee costs
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Office Rent (Monthly)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={expenses.officeRent}
                  onChange={(e) => handleInputChange('officeRent', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-[#0D1D1E] border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Monthly office rent and utilities
              </p>
            </div>
          </div>
        </div>


      {/* Summary Card */}
      <div className="bg-[#00131C] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Expense Summary</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              ₹{expenses.agencyFees.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400">Agency Fees</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              ₹{expenses.rtoHandlingFees.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400">RTO Handling</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {expenses.paymentGatewayFeePercent}%
            </div>
            <div className="text-xs text-gray-400">Gateway Fees</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              ₹{expenses.staffFees.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400">Staff Fees</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              ₹{expenses.officeRent.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400">Office Rent</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">
              ₹{expenses.otherExpenses.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400">Other</div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Fixed Monthly Expenses:</span>
            <span className="text-2xl font-bold text-red-400">
              ₹{(totalMonthlyExpenses).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            * Payment gateway fees are calculated as percentage of revenue
          </p>
        </div>
      </div>
    </div>
  );
};

export default BusinessExpenses;