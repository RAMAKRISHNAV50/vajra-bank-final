import React, { useState } from "react";
import Navbar from "../components/Navbar"

const LoanSanctionPredictor = () => {
  const [formData, setFormData] = useState({
    Age: "",
    "Employment Type": "",
    "Credit Score": "",
    "Current Location": "",
    Tenure: "",
    "Years in Current City": "",
    "Years in Current Job": "",
    "Insurance Premiums": "",
    "Residential Status": "",
    "Residence Type": "",
    "Loan Type": "",
    AnnualIncome: "",
    requested_amount: "",
    years: "",
    annual_interest_rate: ""
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
      "Employment Type": { required: true, message: "Employment Type is required." },
      "Credit Score": { required: true, min: 300, max: 900, message: "Credit Score must be between 300-900." },
      "Current Location": { required: true, message: "Location is required." },
      Tenure: { required: true, min: 0, max: 50, message: "Relationship Tenure is required." },
      "Years in Current City": { required: true, min: 0, max: 50, message: "Years in City is required." },
      "Years in Current Job": { required: true, min: 0, max: 50, message: "Years in Job is required." },
      "Insurance Premiums": { required: true, min: 0, max: 1000000, message: "Insurance Premiums required." },
      "Residential Status": { required: true, message: "Residential Status is required." },
      "Residence Type": { required: true, message: "Residence Type is required." },
      "Loan Type": { required: true, message: "Loan Type is required." },
      AnnualIncome: { required: true, min: 10000, message: "Annual Income must be at least ₹10,000." },
      requested_amount: { required: true, min: 1000, message: "Requested Amount must be at least ₹1,000." },
      years: { required: true, min: 1, max: 30, message: "Loan Tenure must be 1-30 years." },
      annual_interest_rate: { required: true, min: 1, max: 30, message: "Rate must be 1-30%." }
    };

    for (const [key, rule] of Object.entries(rules)) {
      const val = formData[key];
      if (rule.required && (val === "" || val === null || val === undefined)) {
        newErrors[key] = `${key} is required.`;
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
      setError("Please fill all required fields correctly.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/predict-loan", {
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
            reason: `Exceeds eligibility. You are eligible only up to ₹${Math.round(eligible_amount).toLocaleString("en-IN")}.`
          });
        } else {
          const P = requested_amount, r = annual_interest_rate / 12 / 100, n = years * 12;
          const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
          const total_payment = emi * n;
          const total_interest = total_payment - P;

          setOffer({
            status: "Eligible",
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
      setError("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Card: Input Form */}
            <div className="lg:col-span-2 bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 sm:p-10 text-white text-center">
                <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight">AI-Powered Loan Sanction Engine</h1>
                <p className="text-blue-100 text-xs sm:text-sm mt-2 font-medium opacity-90">Real‑Time AI Eligibility & EMI Calculation</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  
                  {/* Row 1: Personal Basics */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Age</label>
                    <input type="number" name="Age" value={formData.Age} onChange={handleChange} placeholder="e.g. 45" className={`bg-slate-700 border ${errors.Age ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Current Location</label>
                    <input type="text" name="Current Location" value={formData["Current Location"]} onChange={handleChange} placeholder="City Name" className={`bg-slate-700 border ${errors["Current Location"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Employment Type</label>
                    <select name="Employment Type" value={formData["Employment Type"]} onChange={handleChange} className={`bg-slate-700 border ${errors["Employment Type"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500`}>
                      <option value="">Select</option>
                      <option value="Business">Business</option>
                      <option value="Salaried">Salaried</option>
                      <option value="Freelancer">Freelancer</option>
                      <option value="Self-Employed">Self-Employed</option>
                    </select>
                  </div>

                  {/* Row 2: Financial/Job Metrics */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Annual Income (₹)</label>
                    <input type="number" name="AnnualIncome" value={formData.AnnualIncome} onChange={handleChange} placeholder="Yearly Salary" className={`bg-slate-700 border ${errors.AnnualIncome ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Years in Current Job</label>
                    <input type="number" name="Years in Current Job" value={formData["Years in Current Job"]} onChange={handleChange} placeholder="e.g. 3" className={`bg-slate-700 border ${errors["Years in Current Job"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Years in Current City</label>
                    <input type="number" name="Years in Current City" value={formData["Years in Current City"]} onChange={handleChange} placeholder="e.g. 5" className={`bg-slate-700 border ${errors["Years in Current City"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>

                  {/* Row 3: Housing/History */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Credit Score</label>
                    <input type="number" name="Credit Score" value={formData["Credit Score"]} onChange={handleChange} placeholder="300 - 900" className={`bg-slate-700 border ${errors["Credit Score"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Residential Status</label>
                    <select name="Residential Status" value={formData["Residential Status"]} onChange={handleChange} className={`bg-slate-700 border ${errors["Residential Status"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500`}>
                      <option value="">Select</option>
                      <option value="Owned">Owned</option>
                      <option value="Rented">Rented</option>
                      <option value="Company Provided">Company Provided</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Residence Type</label>
                    <select name="Residence Type" value={formData["Residence Type"]} onChange={handleChange} className={`bg-slate-700 border ${errors["Residence Type"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500`}>
                      <option value="">Select</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Independent House">Independent House</option>
                      <option value="Villa">Villa</option>
                    </select>
                  </div>

                  {/* Row 4: Bank Relationship */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Banking Tenure (Yrs)</label>
                    <input type="number" name="Tenure" value={formData.Tenure} onChange={handleChange} placeholder="e.g. 4" className={`bg-slate-700 border ${errors.Tenure ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Insurance Premiums (₹)</label>
                    <input type="number" name="Insurance Premiums" value={formData["Insurance Premiums"]} onChange={handleChange} placeholder="e.g. 2000" className={`bg-slate-700 border ${errors["Insurance Premiums"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Loan Type</label>
                    <select name="Loan Type" value={formData["Loan Type"]} onChange={handleChange} className={`bg-slate-700 border ${errors["Loan Type"] ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500`}>
                      <option value="">Select</option>
                      <option value="Personal">Personal</option>
                      <option value="Auto">Auto</option>
                      <option value="Mortgage">Mortgage</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Row 5: Application Details */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Requested Loan (₹)</label>
                    <input type="number" name="requested_amount" value={formData.requested_amount} onChange={handleChange} placeholder="e.g. 500000" className={`bg-slate-700 border ${errors.requested_amount ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Loan tenure (Years)</label>
                    <input type="number" name="years" value={formData.years} onChange={handleChange} placeholder="e.g. 5" className={`bg-slate-700 border ${errors.years ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Interest Rate (%)</label>
                    <input type="number" name="annual_interest_rate" value={formData.annual_interest_rate} onChange={handleChange} placeholder="e.g. 11" className={`bg-slate-700 border ${errors.annual_interest_rate ? "border-red-500" : "border-slate-600"} text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none`} />
                  </div>
                </div>

                {error && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-xs font-bold uppercase tracking-widest">{error}</div>}

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all transform active:scale-[0.98] disabled:opacity-50 mt-8 shadow-xl uppercase tracking-widest text-sm">
                  {loading ? "Calculating Offer..." : "Calculate Offer"}
                </button>
              </form>
            </div>

            {/* Right Card: Prediction Results */}
            <div className="lg:col-span-1 flex flex-col min-h-[400px] sticky top-6 gap-6">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3 text-amber-400 shadow-xl">
                <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-widest">AI Prediction Disclaimer</h3>
                  <p className="text-[10px] opacity-80 mt-1 leading-relaxed">Our AI models can occasionally make mistakes. Please consult a respected representative to confirm your true eligibility profile.</p>
                </div>
              </div>

              {offer ? (
                <div className={`p-1 rounded-3xl shadow-2xl flex-grow ${offer.status === "Eligible" ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30" : "bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30"}`}>
                  <div className="p-6 bg-slate-800/90 rounded-[calc(1.5rem-1px)] h-full">
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                        <span className={`text-2xl font-black uppercase tracking-tight ${offer.status === "Eligible" ? "text-emerald-400" : "text-red-400"}`}>{offer.status}</span>
                      </div>
                    </div>
                    {offer.status === "Eligible" ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Eligible Limit</p>
                          <p className="text-xl font-bold text-white">₹{offer.eligible_amount.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monthly EMI</p>
                          <p className="text-xl font-bold text-blue-400">₹{offer.EMI.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Interest</p>
                            <p className="text-sm font-bold text-slate-300">₹{offer["Total Interest"].toLocaleString("en-IN")}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Repayment</p>
                            <p className="text-sm font-bold text-slate-300">₹{offer["Total Payment"].toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/20"><p className="text-sm font-medium text-red-300">{offer.reason}</p></div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-slate-800/50 rounded-3xl border border-slate-700 border-dashed shadow-inner">
                   <h3 className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Awaiting Data</h3>
                   <p className="text-slate-500 text-[10px] leading-relaxed">Fill out the parameters and calculate to see results.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoanSanctionPredictor;