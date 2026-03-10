import React, { useState } from "react";
import Navbar from "../components/Navbar";

const InputField = ({ label, name, type = "text", placeholder, options, value, error, onChange }) => (
  <div className="flex flex-col space-y-1.5">
    <label className="text-xs font-bold text-slate-400 uppercase tracking-tight ml-1">{label}</label>
    {options ? (
      <div className="relative">
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          className={`w-full bg-slate-800/40 border ${error ? "border-red-500/50" : "border-slate-700 focus:border-indigo-500"} text-slate-100 rounded-xl px-4 py-3 text-base outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer`}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    ) : (
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-slate-800/40 border ${error ? "border-red-500/50" : "border-slate-700 focus:border-indigo-500"} text-slate-100 rounded-xl px-4 py-3 text-base outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600`}
      />
    )}
    {error && <span className="text-[10px] text-red-400 font-medium ml-1 uppercase">{error}</span>}
  </div>
);

const LoanSanctionPredictor = () => {
  const [formData, setFormData] = useState({
    Age: 35,
    "Employment Type": "Salaried",
    "Credit Score": 750,
    "Current Location": "Mumbai",
    "Years in Current City": 4,
    "Years in Current Job": 3,
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
    setFormData(prev => ({ ...prev, [name]: type === "number" && value !== "" ? parseFloat(value) : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOffer(null);

    try {
      const response = await fetch("https://vajra-bank-backend.onrender.com/api/predict-loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (data.success) {
        const eligible = data.predictedLoanAmount;
        const P = formData.requested_amount, r = formData.annual_interest_rate / 12 / 100, n = formData.years * 12;
        const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        
        setOffer({
          status: formData.requested_amount <= eligible ? "Approved" : "Partial Approval",
          eligible_amount: Math.round(eligible),
          requested_amount: formData.requested_amount,
          EMI: Math.round(emi),
          totalInterest: Math.round(emi * n - P),
          totalPayment: Math.round(emi * n),
          isExceeded: formData.requested_amount > eligible
        });
      } else {
        setError(data.predictedLoanAmount || "Analysis failed.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-300 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 pt-8 lg:pt-12">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left: 13-Field Form */}
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-3xl font-black text-white tracking-tight">AI Loan Assessment</h1>
              <p className="text-slate-500 mt-1">Complete all 13 fields for an accurate eligibility score.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Group */}
                <div className="md:col-span-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800 pb-2">Profile & Stability</div>
                <InputField label="Age" name="Age" type="number" value={formData.Age} error={errors.Age} onChange={handleChange} />
                <InputField label="Location" name="Current Location" options={["Mumbai", "Hyderabad", "Bengaluru", "Chennai", "Kochi", "Pune", "Kolkata"]} value={formData["Current Location"]} error={errors["Current Location"]} onChange={handleChange} />
                <InputField label="Employment Type" name="Employment Type" options={["Salaried", "Business", "Freelancer", "Self-Employed"]} value={formData["Employment Type"]} error={errors["Employment Type"]} onChange={handleChange} />
                <InputField label="Credit Score" name="Credit Score" type="number" value={formData["Credit Score"]} error={errors["Credit Score"]} onChange={handleChange} />
                <InputField label="Years in Job" name="Years in Current Job" type="number" value={formData["Years in Current Job"]} error={errors["Years in Current Job"]} onChange={handleChange} />
                <InputField label="Years in City" name="Years in Current City" type="number" value={formData["Years in Current City"]} error={errors["Years in Current City"]} onChange={handleChange} />
                
                {/* Residence Group */}
                <div className="md:col-span-2 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800 pb-2 mt-4">Housing Details</div>
                <InputField label="Residential Status" name="Residential Status" options={["Owned", "Rented", "Company Provided"]} value={formData["Residential Status"]} error={errors["Residential Status"]} onChange={handleChange} />
                <InputField label="Residence Type" name="Residence Type" options={["Apartment", "Independent House", "Villa"]} value={formData["Residence Type"]} error={errors["Residence Type"]} onChange={handleChange} />

                {/* Financial Group */}
                <div className="md:col-span-2 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800 pb-2 mt-4">Loan Requirements</div>
                <InputField label="Annual Income (₹)" name="AnnualIncome" type="number" value={formData.AnnualIncome} error={errors.AnnualIncome} onChange={handleChange} />
                <InputField label="Loan Type" name="Loan Type" options={["Personal", "Auto", "Mortgage", "Other"]} value={formData["Loan Type"]} error={errors["Loan Type"]} onChange={handleChange} />
                <InputField label="Requested Amount (₹)" name="requested_amount" type="number" value={formData.requested_amount} error={errors.requested_amount} onChange={handleChange} />
                <InputField label="Tenure (Years)" name="years" type="number" value={formData.years} error={errors.years} onChange={handleChange} />
                <div className="md:col-span-2">
                  <InputField label="Expected Interest Rate (%)" name="annual_interest_rate" type="number" value={formData.annual_interest_rate} error={errors.annual_interest_rate} onChange={handleChange} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                {loading ? "PROCESSING..." : "GET ELIGIBILITY SCORE"}
              </button>
            </form>
          </div>

          {/* Right: Results & Disclaimers */}
          <div className="lg:w-[400px] lg:sticky lg:top-8 space-y-6">
            {offer ? (
              <div className={`rounded-3xl border shadow-2xl overflow-hidden ${offer.isExceeded ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                <div className={`p-4 text-center text-[10px] font-black tracking-widest uppercase text-white ${offer.isExceeded ? "bg-amber-600" : "bg-emerald-600"}`}>
                  {offer.isExceeded ? "Amount Limit Exceeded" : "Profile Approved"}
                </div>
                
                <div className="p-6 bg-slate-900/90 space-y-6">
                  {/* Eligibility Comparison */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Requested Amount</p>
                        <p className="text-xl font-bold text-white">₹{offer.requested_amount.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Eligibility Limit</p>
                        <p className={`text-xl font-bold ${offer.isExceeded ? "text-red-400" : "text-emerald-400"}`}>
                          ₹{offer.eligible_amount.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar Visual */}
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full ${offer.isExceeded ? "bg-red-500" : "bg-emerald-500"}`} 
                        style={{ width: `${Math.min((offer.requested_amount / offer.eligible_amount) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-800"></div>

                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Estimated EMI</p>
                    <h2 className="text-4xl font-black text-white mt-1">₹{offer.EMI.toLocaleString("en-IN")}<span className="text-sm text-slate-500 font-normal">/mo</span></h2>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-medium"><span className="text-slate-500">Total Interest</span><span className="text-slate-300">₹{offer.totalInterest.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between font-bold pt-2 border-t border-slate-800"><span className="text-slate-400">Total Repayment</span><span className="text-indigo-400">₹{offer.totalPayment.toLocaleString("en-IN")}</span></div>
                  </div>

                  {/* Contextual Warning */}
                  {offer.isExceeded && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 leading-relaxed italic">
                      Warning: Your requested amount (₹{offer.requested_amount.toLocaleString()}) exceeds your calculated eligibility of ₹{offer.eligible_amount.toLocaleString()}. Please reduce the amount for a higher chance of approval.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Awaiting Submission</p>
              </div>
            )}

            {/* Disclaimer Section */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-white uppercase flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                Important Disclaimers
              </h4>
              <ul className="text-[10px] text-slate-500 space-y-2 leading-relaxed list-disc ml-4">
                <li><strong>AI Estimation:</strong> This prediction is generated by a machine learning model based on historical banking data. It does not constitute a legal offer.</li>
                <li><strong>Verification:</strong> All final sanctions are subject to physical document verification and internal bank credit policies.</li>
                <li><strong>Credit Score:</strong> The score provided by the user is used for simulation; actual bank-pulled CIBIL/Experian scores may differ.</li>
                <li><strong>Interest Rates:</strong> Rates are indicative and vary based on daily bank base rates and individual risk premiums.</li>
              </ul>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default LoanSanctionPredictor;