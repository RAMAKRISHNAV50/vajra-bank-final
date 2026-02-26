import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import UserAnalytics from '../../components/user/UserAnalytics';
import RecommendationSection from "../../pages/user/Recommendations";
import { ArrowUpRight, Plus, Activity, PersonBadge, ArrowDownLeft, Wallet, Copy, Phone, GeoAlt, Calendar3 } from 'react-bootstrap-icons';
import { userDB } from "../../firebaseUser";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import CreditUtilization from '../../components/user/CreditUtilization';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [firestoreBankData, setFirestoreBankData] = useState([]);
  const [firestoreNewUserData, setFirestoreNewUserData] = useState([]);
  const [firebaseTxns, setFirebaseTxns] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState("Analyzing...");
  const [displayRisk, setDisplayRisk] = useState("Analyzing...");
  const [rawLatestRecord, setRawLatestRecord] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCibil, setShowCibil] = useState(false);
  const [isCheckingCibil, setIsCheckingCibil] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  // --- 1. FIREBASE LISTENERS ---
  useEffect(() => {
    if (!user?.email) return;

    const q1 = query(collection(userDB, "users1"), where("Email", "==", user.email));
    const unsub1 = onSnapshot(q1, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreBankData(data);
      if (data.length > 0) setDataLoading(false);
    });

    const q2 = query(collection(userDB, "users"), where("Email", "==", user.email));
    const unsub2 = onSnapshot(q2, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreNewUserData(data);
      setDataLoading(false);
    });

    const q3 = query(collection(userDB, "transfer"), where("senderEmail", "==", user.email.toLowerCase()));
    const unsub3 = onSnapshot(q3, (snapshot) => {
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        type: doc.data().type === "Deposit" ? 'Deposit' : 'Transfer',
        amount: doc.data().amount,
        date: doc.data().timestamp?.toDate().toLocaleDateString() || new Date().toLocaleDateString(),
        reason: doc.data().reason || "Transaction",
      }));
      setFirebaseTxns(txns);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  // --- 2. DATA PROCESSING ---
  const userData = useMemo(() => {
    if (!user) return null;
    const bankRecord = firestoreBankData[0];
    const newRecord = firestoreNewUserData[0];
    const activeRecord = bankRecord || newRecord;
    if (!activeRecord) return null;

    if (!rawLatestRecord || rawLatestRecord["Customer ID"] !== activeRecord["Customer ID"]) {
      setRawLatestRecord(activeRecord);
    }

    const historicalTxns = firestoreBankData.filter(item => item.TransactionID).map(item => ({
      id: item.TransactionID,
      type: item["Transaction Type"] === "Withdrawal" ? 'Transfer' : 'Deposit',
      amount: item["Transaction Amount"],
      date: item["Transaction Date"],
      reason: item["Transaction_Reason"] || item["Transaction Type"]
    }));

    return {
      fullName: activeRecord.fullName || `${activeRecord["First Name"] || ""} ${activeRecord["Last Name"] || ""}`.trim(),
      email: activeRecord["Email"] || activeRecord.email,
      customerId: activeRecord["Customer ID"] || "Pending",
      balance: Number(activeRecord["Account Balance"] || activeRecord.balance || 0),
      rewards: Number(activeRecord["Rewards Points"] || 0),
      cibil: Number(activeRecord["CIBIL_Score"] || 0),
      panCard: activeRecord["PAN_Card"] || "N/A",
      accountNumber: activeRecord["Account_Number"] || activeRecord.accountNumber || "N/A",
      ifscCode: activeRecord["IFSC Code"] || "VAJ000524",
      contact: activeRecord["Contact Number"] || activeRecord.contact || "N/A",
      gender: activeRecord["Gender"] || "N/A",
      age: activeRecord["Age"] || "N/A",
      address: activeRecord["Address"] || "Not Available",
      creditLimit: Number(activeRecord["Credit Limit"] || 50000),
      ccBalance: Number(activeRecord["Credit Card Balance"] || 0),
      status: activeRecord["ActiveStatus"] || "Pending",
      transactions: [...firebaseTxns, ...historicalTxns].sort((a, b) => new Date(b.date) - new Date(a.date))
    };
  }, [firestoreBankData, firestoreNewUserData, user, firebaseTxns, rawLatestRecord]);

  // --- 3. UPDATED GAUSSIAN RISK PREDICTION ---
  useEffect(() => {
    if (rawLatestRecord) {
      setIsAnalyzing(true);
      const payload = {
        Age: Number(rawLatestRecord.Age || 30),
        "Account Balance": Number(rawLatestRecord["Account Balance"] || 0),
        "Loan Amount": Number(rawLatestRecord["Loan Amount"] || 0),
        "Loan Type": rawLatestRecord["Loan Type"] || "other",
        "Interest Rate": Number(rawLatestRecord["Interest Rate"] || 0),
        "Loan Term": Number(rawLatestRecord["Loan Term"] || 0),
        "Loan Status": rawLatestRecord["Loan Status"] || "Closed",
        "Credit Limit": Number(rawLatestRecord["Credit Limit"] || 0),
        "Credit Card Balance": Number(rawLatestRecord["Credit Card Balance"] || 0),
        "Credit Utilization": Number(rawLatestRecord["Credit Utilization"] || 0),
        "Minimum Payment Due": Number(rawLatestRecord["Minimum Payment Due"] || 0),
        "Payment Delay Days": Number(rawLatestRecord["Payment Delay Days"] || 0),
        "CIBIL_Score": Number(rawLatestRecord["CIBIL_Score"] || 600),
        ActiveStatus: rawLatestRecord.ActiveStatus || "Inactive"
      };

      fetch("http://127.0.0.1:8000/api/predict-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
            const riskMapping = { "0": "Low", "1": "Medium", "2": "High" };
            setRiskLevel(data.success ? (riskMapping[data.predictedRisk] || data.predictedRisk) : "Low");
        })
        .catch(() => setRiskLevel("Safe"))
        .finally(() => setIsAnalyzing(false));
    }
  }, [rawLatestRecord]);

  useEffect(() => {
    setDisplayRisk(isAnalyzing ? "Analyzing..." : riskLevel);
  }, [isAnalyzing, riskLevel]);

  const handleCibilCheck = () => {
    setIsCheckingCibil(true);
    setTimeout(() => {
      setIsCheckingCibil(false);
      setShowCibil(true);
      let start = 0;
      const end = Math.round(userData?.cibil || 300);
      const timer = setInterval(() => {
        start += Math.ceil(end / 40);
        if (start >= end) { setAnimatedScore(end); clearInterval(timer); }
        else { setAnimatedScore(Math.floor(start)); }
      }, 30);
    }, 1500);
  };

  if (authLoading || (dataLoading && !userData)) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase">{userData?.fullName}</h1>
          <p className="text-slate-500 font-mono">ID: {userData?.customerId}</p>
        </div>
        <button onClick={() => navigate('/user/transfer')} className="bg-white text-slate-950 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
          + New Transaction
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-[2rem] relative overflow-hidden">
          <p className="text-indigo-100/70 text-xs font-bold uppercase tracking-widest">Available Balance</p>
          <h2 className="text-4xl font-black text-white mt-2">₹{userData?.balance.toLocaleString()}</h2>
          <Wallet className="absolute right-[-10px] bottom-[-10px] text-white/10 size-32" />
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem]">
          <p className="text-purple-400 text-xs font-bold uppercase flex items-center gap-2">
            <Activity className={isAnalyzing ? "animate-spin" : ""} size={14} /> Credit Risk
          </p>
          <h3 className={`text-2xl font-black mt-2 ${displayRisk === 'High' ? 'text-rose-500' : 'text-emerald-400'}`}>{displayRisk}</h3>
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem]">
          <p className="text-amber-500 text-xs font-bold uppercase">Rewards</p>
          <h3 className="text-2xl font-black text-white mt-2">{Math.floor(userData?.rewards)}</h3>
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] text-center">
          <p className="text-slate-500 text-xs font-bold uppercase">Status</p>
          <span className="px-3 py-1 rounded-full border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase">{userData?.status}</span>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Details Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-white/5">
            <h4 className="text-white font-bold mb-6 uppercase text-[10px] tracking-widest opacity-40 flex items-center gap-2">
              <PersonBadge /> Identity & Contact
            </h4>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">A/C NUMBER</span>
                <span className="text-white font-mono">{userData?.accountNumber}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">IFSC CODE</span>
                <span className="text-white font-mono">{userData?.ifscCode}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">PAN CARD</span>
                <span className="text-indigo-400 font-mono font-bold uppercase">{userData?.panCard}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">GENDER / AGE</span>
                <span className="text-white">{userData?.gender} / {userData?.age} yrs</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">PHONE</span>
                <span className="text-white">{userData?.contact}</span>
              </div>
              <div className="pt-2">
                <p className="text-slate-500 mb-1 uppercase text-[9px] font-bold">Billing Address</p>
                <p className="text-white leading-relaxed">{userData?.address}</p>
              </div>

              <button onClick={handleCibilCheck} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-black mt-4 transition-all uppercase tracking-tighter text-[11px]">
                {showCibil ? `CIBIL Score: ${animatedScore}` : 'Refresh Credit Score'}
              </button>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] border border-white/5 overflow-hidden">
          <div className="px-8 py-5 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <span className="text-white font-bold text-xs uppercase tracking-widest">Recent Activity</span>
            <NavLink to="/user/transactions" className="text-indigo-400 text-[10px] font-bold uppercase">View History</NavLink>
          </div>
          <div className="divide-y divide-white/5">
            {userData?.transactions.length > 0 ? (
              userData.transactions.slice(0, 6).map((txn, i) => (
                <div key={i} className="px-8 py-5 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${txn.type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {txn.type === 'Deposit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{txn.reason}</p>
                      <p className="text-slate-500 text-[10px] uppercase tracking-tighter">{txn.date}</p>
                    </div>
                  </div>
                  <span className={`font-mono font-bold ${txn.type === 'Deposit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {txn.type === 'Deposit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-slate-500 text-xs italic">No transactions found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Insights */}
      <div className="mt-8">
        <RecommendationSection riskLevel={displayRisk} />
      </div>
    </div>
  );
}