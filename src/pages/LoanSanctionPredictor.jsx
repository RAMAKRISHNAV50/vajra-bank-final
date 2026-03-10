import React, { useState } from "react";
import Navbar from "../components/Navbar";

// Reusable Input Component moved OUTSIDE to prevent re-rendering focus loss
const InputField = ({ label, name, type = "text", placeholder, options, value, error, onChange }) => (
  <div className="flex flex-col space-y-1.5">
    <label className="text-sm font-medium text-slate-300">{label}</label>
    {options ? (
      <select
        name={name}
        value={value || ""}
        onChange={onChange}
        className={`w-full bg-slate-900/50 border ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"} text-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-4 transition-all duration-200`}
      >
        <option value="" disabled>Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-slate-900/50 border ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"} text-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-4 transition-all duration-200`}
      />
    )}
    {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
  </div>
);

const LoanSanctionPredictor = () => {
  const [formData, setFormData] = useState({
    Age: 35,
    "Employment Type": "Salaried",
    "Credit Score": 750,
    "Current Location": "Mumbai",
    Tenure: 5,
    "Years in Current City": 4,
    "Years in Current Job": 3,
    "Insurance Premiums": 5000,
    "Residential Status": "Owned",
    "Residence Type": "Apartment",
    "Loan Type": "Personal",
    AnnualIncome: 1200000,
    requested_amount: 500000,
    years: 5,
    annual_interest_rate: 10.5
  });

  const [errors, setErrors] = useState({});
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" && value !== "" ? parseFloat(value) : value
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const rules = {
      Age: { required: true, min: 18, max: 100, message: "Age must be at least 18." },
      "Employment Type": { required: true, message: "Required." },
      "Credit Score": { required: true, min: 300, max: 900, message: "Must be 300-900." },
      "Current Location": { required: true, message: "Required." },
      Tenure: { required: true, min: 0, max: 50, message: "Required." },
      "Years in Current City": { required: true, min: 0, max: 50, message: "Required." },
      "Years in Current Job": { required: true, min: 0, max: 50, message: "Required." },
      "Insurance Premiums": { required: true, min: 0, max: 1000000, message: "Required." },
      "Residential Status": { required: true, message: "Required." },
      "Residence Type": { required: true, message: "Required." },
      "Loan Type": { required: true, message: "Required." },
      AnnualIncome: { required: true, min: 10000, message: "Min ₹10,000." },
      requested_amount: { required: true, min: 1000, message: "Min ₹1,000." },
      years: { required: true, min: 1, max: 30, message: "Must be 1-30 yrs." },
      annual_interest_rate: { required: true, min: 1, max: 30, message: "Rate 1-30%." }
    };

    for (const [key, rule] of Object.entries(rules)) {
      const val = formData[key];
      if (rule.required && (val === "" || val === null || val === undefined)) {
        newErrors[key] = `Required`;
        continue;
      }
      if (typeof val === "number") {
        if (rule.min !== undefined && val < rule.min) newErrors[key] = rule.message;
        else if (rule.max !== undefined && val > rule.max) newErrors[key] = rule.message;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOffer(null);

    if (!validateForm()) {
      setLoading(false);
      setError("Please check the highlighted fields and try again.");
      return;
    }

    try {
      const response = await fetch("https://vajra-bank-backend.onrender.com/api/predict-loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        const eligible_amount = data.predictedLoanAmount;
        const { requested_amount, years, annual_interest_rate } = formData;

        if (requested_amount > eligible_amount) {
          setOffer({
            status: "Rejected",
            eligible_amount: Math.round(eligible_amount),
            requested_amount,
            reason: `Amount exceeds eligibility. You are approved for up to ₹${Math.round(eligible_amount).toLocaleString("en-IN")}.`
          });
        } else {
          const P = requested_amount, r = annual_interest_rate / 12 / 100, n = years * 12;
          const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
          const total_payment = emi * n;
          const total_interest = total_payment - P;

          setOffer({
            status: "Approved",
            eligible_amount: Math.round(eligible_amount),
            requested_amount,
            tenure_years: years,
            interest_rate: annual_interest_rate,
            EMI: Math.round(emi * 100) / 100,
            "Total Interest": Math.round(total_interest * 100) / 100,
            "Total Payment": Math.round(total_payment * 100) / 100
          });
        }
      } else {
        setError(data.predictedLoanAmount || "Prediction failed.");
      }
    } catch (err) {
      setError("Unable to connect to the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Loan Eligibility Predictor</h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">Get instant AI-powered insights on your loan approval chances and EMI estimates.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left Column: Form */}
          <div className="lg:col-span-8 bg-[#1E293B] border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-10">

              {/* Section 1: Personal Profile */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">1</div>
                  Personal Profile
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField label="Age" name="Age" type="number" placeholder="e.g. 30" value={formData.Age} error={errors.Age} onChange={handleChange} />
                  
                  {/* UPDATED: Current Location is now a dropdown menu */}
                  <InputField 
                    label="Current Location" 
                    name="Current Location" 
                    options={["Hyderabad", "Mumbai", "Bengaluru", "Chennai", "Kochi", "Pune", "Kolkata"]} 
                    value={formData["Current Location"]} 
                    error={errors["Current Location"]} 
                    onChange={handleChange} 
                  />

                  <InputField label="Employment Type" name="Employment Type" options={["Salaried", "Business", "Freelancer", "Self-Employed"]} value={formData["Employment Type"]} error={errors["Employment Type"]} onChange={handleChange} />
                  <InputField label="Credit Score" name="Credit Score" type="number" placeholder="300 - 900" value={formData["Credit Score"]} error={errors["Credit Score"]} onChange={handleChange} />
                </div>
              </div>

              <hr className="border-slate-800" />

              {/* Section 2: Financial & Stability */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">2</div>
                  Financials & Stability
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField label="Annual Income (₹)" name="AnnualIncome" type="number" placeholder="Yearly Salary" value={formData.AnnualIncome} error={errors.AnnualIncome} onChange={handleChange} />
                  <InputField label="Insurance Premiums (₹)" name="Insurance Premiums" type="number" placeholder="e.g. 5000" value={formData["Insurance Premiums"]} error={errors["Insurance Premiums"]} onChange={handleChange} />
                  <InputField label="Years in Current Job" name="Years in Current Job" type="number" placeholder="e.g. 3" value={formData["Years in Current Job"]} error={errors["Years in Current Job"]} onChange={handleChange} />
                  <InputField label="Years in Current City" name="Years in Current City" type="number" placeholder="e.g. 4" value={formData["Years in Current City"]} error={errors["Years in Current City"]} onChange={handleChange} />
                  <InputField label="Residential Status" name="Residential Status" options={["Owned", "Rented", "Company Provided"]} value={formData["Residential Status"]} error={errors["Residential Status"]} onChange={handleChange} />
                  <InputField label="Residence Type" name="Residence Type" options={["Apartment", "Independent House", "Villa"]} value={formData["Residence Type"]} error={errors["Residence Type"]} onChange={handleChange} />
                </div>
              </div>

              <hr className="border-slate-800" />

              {/* Section 3: Loan Requirements */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">3</div>
                  Loan Requirements
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField label="Loan Type" name="Loan Type" options={["Personal", "Auto", "Mortgage", "Other"]} value={formData["Loan Type"]} error={errors["Loan Type"]} onChange={handleChange} />
                  <InputField label="Banking Tenure (Years)" name="Tenure" type="number" placeholder="Years with bank" value={formData.Tenure} error={errors.Tenure} onChange={handleChange} />
                  <InputField label="Requested Loan (₹)" name="requested_amount" type="number" placeholder="e.g. 500000" value={formData.requested_amount} error={errors.requested_amount} onChange={handleChange} />
                  <InputField label="Loan Tenure (Years)" name="years" type="number" placeholder="e.g. 5" value={formData.years} error={errors.years} onChange={handleChange} />
                  <div className="sm:col-span-2">
                    <InputField label="Expected Interest Rate (%)" name="annual_interest_rate" type="number" placeholder="e.g. 10.5" value={formData.annual_interest_rate} error={errors.annual_interest_rate} onChange={handleChange} />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all duration-200 transform active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/25 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Analyzing Profile...
                  </>
                ) : "Calculate Eligibility & Offer"}
              </button>
            </form>
          </div>

          {/* Right Column: Results sticky container */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-8">

            {/* Disclaimer Alert */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex items-start gap-3 text-amber-300">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-sm text-amber-200 mb-1">AI Prediction Disclaimer</h3>
                <p className="text-xs opacity-90 leading-relaxed text-amber-100/80">
                  Predictions are based on algorithmic models and historical data. Final approvals are subject to official bank verification.
                </p>
              </div>
            </div>

            {/* Results Card */}
            {offer ? (
              <div className={`rounded-3xl shadow-2xl border overflow-hidden ${offer.status === "Approved" ? "bg-[#1E293B] border-emerald-500/30" : "bg-[#1E293B] border-red-500/30"}`}>

                {/* Status Header */}
                <div className={`p-6 text-center border-b ${offer.status === "Approved" ? "bg-emerald-500/10 border-emerald-500/10" : "bg-red-500/10 border-red-500/10"}`}>
                  <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-2 ${offer.status === "Approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {offer.status}
                  </span>
                  {offer.status === "Approved" ? (
                    <p className="text-sm text-slate-300">Congratulations! Your profile looks great.</p>
                  ) : (
                    <p className="text-sm text-slate-300">Action required on your application.</p>
                  )}
                </div>

                {/* Offer Details */}
                <div className="p-6">
                  {offer.status === "Approved" ? (
                    <div className="space-y-5">
                      <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                        <span className="text-sm text-slate-400">Max Eligibility</span>
                        <span className="text-xl font-bold text-white">₹{offer.eligible_amount.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                        <span className="text-sm text-slate-400">Est. Monthly EMI</span>
                        <span className="text-xl font-bold text-indigo-400">₹{offer.EMI.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Total Interest</span>
                        <span className="text-sm font-medium text-slate-200">₹{offer["Total Interest"].toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Total Repayment</span>
                        <span className="text-sm font-medium text-slate-200">₹{offer["Total Payment"].toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-slate-300 leading-relaxed">{offer.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center h-[350px]">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-white font-medium mb-2">Awaiting Analysis</h3>
                <p className="text-slate-400 text-sm">Submit your profile details on the left to generate your loan prediction and EMI schedule.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default LoanSanctionPredictor;