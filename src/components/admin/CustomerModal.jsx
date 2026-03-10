import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, ShieldExclamation, Activity, Wallet2, 
    CreditCard, Snow, PersonBadge, CashStack,
    PencilSquare, Check, XCircle
} from 'react-bootstrap-icons';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { userDB } from '../../firebaseUser';

export default function CustomerModal({ customer, onAction, onClose }) {
    const [firebaseData, setFirebaseData] = useState(null);
    const [riskData, setRiskData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [docRef, setDocRef] = useState(null);

    useEffect(() => {
        const fetchFullProfile = async () => {
            const targetId = customer?.["Customer ID"] || customer?.customerId;
            if (!targetId) return;

            setLoading(true);
            try {
                const [snap1, snap2] = await Promise.all([
                    getDocs(query(collection(userDB, 'users'), where("Customer ID", "==", targetId))),
                    getDocs(query(collection(userDB, 'users1'), where("Customer ID", "==", targetId)))
                ]);

                let foundData = null;
                let foundRef = null;

                if (!snap1.empty) {
                    foundData = snap1.docs[0].data();
                    foundRef = snap1.docs[0].ref;
                }
                else if (!snap2.empty) {
                    foundData = snap2.docs[0].data();
                    foundRef = snap2.docs[0].ref;
                }
                
                const currentData = foundData || customer;
                setFirebaseData(currentData);
                setDocRef(foundRef);

                if (customer.isNewUser) {
                    setRiskData({ riskLevel: "Not Applicable" });
                } else {
                    try {
                        const riskRes = await fetch(`https://vajra-bank-backend.onrender.com/api/predict-risk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(currentData) 
                        });
                        
                        if (riskRes.ok) {
                            const rData = await riskRes.json();
                            if (rData.success) {
                                setRiskData({ riskLevel: rData.predictedRisk });
                            } else {
                                setRiskData({ riskLevel: "Pending" });
                            }
                        } else {
                            setRiskData({ riskLevel: "Pending" });
                        }
                    } catch (err) {
                        setRiskData({ riskLevel: "Pending" });
                    }
                }
            } catch (err) {
                console.error("Data Sync Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchFullProfile();
    }, [customer]);

    const toggleEdit = () => {
        if (!isEditing) setEditForm(firebaseData || customer);
        setIsEditing(!isEditing);
    };

    const handleFormChange = (primaryKey, secondaryKey, value) => {
        const targetKey = (editForm[primaryKey] !== undefined) ? primaryKey : (editForm[secondaryKey] !== undefined ? secondaryKey : primaryKey);
        setEditForm(prev => ({ ...prev, [targetKey]: value }));
    };

    const saveChanges = async () => {
        if (!docRef) {
            alert("Cannot update: Customer record is not fully synced.");
            return;
        }
        setLoading(true);
        try {
            const sanitizedData = {};
            Object.keys(editForm).forEach(key => {
                const safeKey = key.replace(/\//g, '_'); 
                sanitizedData[safeKey] = editForm[key];
            });

            await updateDoc(docRef, sanitizedData);
            setFirebaseData(editForm);
            setIsEditing(false);
        } catch (error) {
            console.error("Firebase Update Error:", error);
            alert(`Failed to save: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const c = useMemo(() => {
        const src = isEditing ? editForm : (firebaseData || customer);
        if (!src) return null;

        return {
            id: src["Customer ID"] || src.customerId || "N/A",
            firstName: src["First Name"] || src.firstName || "User",
            lastName: src["Last Name"] || src.lastName || "",
            email: src.Email || src.email || "N/A",
            phone: src["Contact Number"] || src.mobile || "N/A",
            age: src.Age || "—",
            gender: src.Gender || "—",
            address: src.Address || "N/A",
            pan: src.PAN_Card || "—",
            house: src.HouseOwnership || "—",
            nomineeName: src.nomineeName || "—",
            nomineeRelation: src.nomineeRelation || "—",
            status: src.status || src.ActiveStatus || "—",
            residentialStatus: src["Residential Status"] || "—",
            yearsInCity: src.Years_in_Current_City || "—",
            yearsInJob: src.Years_in_Current_Job || "—",
            acctOpenDate: src["Date Of Account Opening"] || "—",
            branchId: src["Branch ID"] || "—",
            txnAmount: Number(src["Transaction Amount"] || 0),
            txnType: src["Transaction Type"] || "—",
            balance: Number(src["Account Balance"] || 0),
            accType: src["Account Type"] || "Savings",
            accNumber: src.Account_Number || "N/A",
            income: Number(src.AnnualIncome || 0),
            cibil: Number(src.CIBIL_Score || 0),
            rewards: src["Rewards Points"] || 0,
            cardType: src["Card Type"] || "—",
            cardLimit: src["Credit Limit"] || 0,
            loanAmount: src["Loan Amount"] || 0,
            interest: src["Interest Rate"] || 0,
            lastTxnDate: src.Last_Transaction_Date || "—",
            paymentDue: src["Payment Due Date"] || "—",
            isFrozen: src.FreezeAccount === true || src.FreezeAccount_Flag === 1,
            profilePic: src.profilePic || "",
            idProof: src.idProofDoc || ""
        };
    }, [firebaseData, customer, isEditing, editForm]);

    if (!customer || !c) return null;

    if (loading) return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-indigo-400 font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-center">Syncing Parameters...</p>
            </div>
        </div>
    );

    const riskLevel = riskData?.riskLevel || customer?.riskLevel || "Pending";
    
    let riskColor = "text-indigo-400";
    if (riskLevel === 'High') riskColor = "text-emerald-400";
    if (riskLevel === 'Medium') riskColor = "text-amber-400";
    if (riskLevel === 'Low') riskColor = "text-rose-500";
    if (riskLevel === 'Not Applicable' || riskLevel === 'Pending') riskColor = "text-slate-500";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#0f1218] border border-white/10 w-full max-w-7xl max-h-[98vh] sm:max-h-[95vh] overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col font-sans">
                
                {/* HEADER */}
                <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
                        <div className="relative shrink-0">
                            <img src={c.profilePic} alt="Profile" className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover border-2 border-white/10 shadow-xl" 
                                 onError={(e) => e.target.src = "https://via.placeholder.com/150"} />
                            <div className={`absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 p-1 sm:p-2 rounded-md sm:rounded-lg ${c.isFrozen ? 'bg-blue-600' : 'bg-emerald-500'} text-white shadow-lg border-2 sm:border-4 border-[#0f1218]`}>
                                {c.isFrozen ? <Snow size={12} className="sm:w-[18px] sm:h-[18px]"/> : <Activity size={12} className="sm:w-[18px] sm:h-[18px]"/>}
                            </div>
                        </div>
                        <div className="min-w-0 flex-grow">
                            {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2 mb-1">
                                    <input type="text" value={c.firstName} onChange={e => handleFormChange("First Name", "firstName", e.target.value)} className="bg-slate-900 border border-indigo-500/50 rounded p-1 text-base sm:text-2xl font-black text-white w-full focus:outline-none" />
                                    <input type="text" value={c.lastName} onChange={e => handleFormChange("Last Name", "lastName", e.target.value)} className="bg-slate-900 border border-indigo-500/50 rounded p-1 text-base sm:text-2xl font-black text-indigo-500 w-full focus:outline-none" />
                                </div>
                            ) : (
                                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight uppercase italic truncate">{c.firstName} <span className="text-indigo-500">{c.lastName}</span></h2>
                            )}
                            <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-4 mt-0.5 sm:mt-1">
                                <span className="text-[8px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-widest truncate">A/C: {c.accNumber}</span>
                                <span className="text-[8px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-widest truncate hidden sm:inline">ID: {c.id}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 transition-all active:scale-90 sm:hidden ml-auto shrink-0 bg-white/5 border border-white/10"><X size={20} /></button>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-3 mt-2 sm:mt-0">
                        <div className="flex gap-2 w-full sm:w-auto">
                            {isEditing ? (
                                <>
                                    <button onClick={saveChanges} className="flex-1 sm:flex-none justify-center p-2 sm:px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg sm:rounded-xl text-white text-[10px] sm:text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
                                        <Check size={14} /> Save
                                    </button>
                                    <button onClick={toggleEdit} className="flex-1 sm:flex-none justify-center p-2 sm:px-4 bg-rose-600/20 hover:bg-rose-600 rounded-lg sm:rounded-xl text-rose-500 hover:text-white border border-rose-500/20 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5">
                                        <XCircle size={14} /> Cancel
                                    </button>
                                </>
                            ) : (
                                <button onClick={toggleEdit} className="w-full sm:w-auto justify-center p-2 sm:px-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl text-white text-[10px] sm:text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
                                    <PencilSquare size={14} /> Edit Profile
                                </button>
                            )}
                        </div>
                        <button onClick={onClose} className="hidden sm:block p-3 hover:bg-white/10 rounded-full text-slate-500 transition-all active:scale-90"><X size={32} /></button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-grow overflow-y-auto p-3 sm:p-6 md:p-8 custom-scrollbar">
                    
                    <div className="mb-4 sm:mb-6 bg-amber-500/10 border border-amber-500/30 p-3 sm:p-4 rounded-xl flex items-start sm:items-center gap-2 sm:gap-4 text-amber-400">
                        <ShieldExclamation size={16} className="sm:w-[24px] sm:h-[24px] flex-shrink-0 mt-0.5 sm:mt-0" />
                        <div>
                            <h3 className="font-bold text-[9px] sm:text-sm uppercase tracking-widest">AI Prediction Disclaimer</h3>
                            <p className="text-[8px] sm:text-xs opacity-80 mt-0.5 sm:mt-1">
                               Our AI models can occasionally make mistakes and predictions are based on historical data patterns. Please consult with the respected person or bank authority to know your exact Credit Profile Status..
                            </p>
                        </div>
                    </div>

                    {/* KPI SECTION (FIXED FOR MOBILE) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-10">
                        <StatBox label="Ledger Balance" value={`₹${c.balance.toLocaleString()}`} color="text-emerald-400" icon={<Wallet2/>}/>
                        <StatBox label="Profile Category" value={riskLevel} color={riskColor} icon={<ShieldExclamation/>}/>
                        <StatBox label="CIBIL Score" value={Math.round(c.cibil)} color="text-amber-400" icon={<Activity/>}/>
                        <StatBox label="Credit Limit" value={`₹${c.cardLimit.toLocaleString()}`} color="text-purple-400" icon={<CreditCard/>}/>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-10">
                        {/* IDENTITY */}
                        <div className="space-y-4 sm:space-y-8">
                            <Section title="Identity Parameters" icon={<PersonBadge/>}>
                                <InfoRow label="Email Access" value={c.email} isEditing={isEditing} onChange={(v) => handleFormChange("Email", "email", v)} />
                                <InfoRow label="Secure Line" value={c.phone} isEditing={isEditing} onChange={(v) => handleFormChange("Contact Number", "mobile", v)} />
                                <InfoRow label="Gender / Age" value={`${c.gender} / ${c.age} Yrs`} /> 
                                <InfoRow label="PAN Ref" value={c.pan} isEditing={isEditing} onChange={(v) => handleFormChange("PAN_Card", "pan", v)} />
                                <InfoRow label="Res. Status" value={c.residentialStatus} isEditing={isEditing} onChange={(v) => handleFormChange("Residential Status", "residentialStatus", v)} />
                                <InfoRow label="Nominee Name" value={c.nomineeName} isEditing={isEditing} onChange={(v) => handleFormChange("nomineeName", "nomineeName", v)} />
                                <InfoRow label="Nominee Rel." value={c.nomineeRelation} isEditing={isEditing} onChange={(v) => handleFormChange("nomineeRelation", "nomineeRelation", v)} />
                            </Section>
                        </div>

                        {/* FINANCIALS */}
                        <div className="space-y-4 sm:space-y-8">
                            <Section title="Financial Ledger" icon={<CashStack/>}>
                                <InfoRow label="Status" value={c.status.toUpperCase()} isEditing={isEditing} onChange={(v) => handleFormChange("status", "ActiveStatus", v)} />
                                <InfoRow label="Annual Income" value={`₹${c.income.toLocaleString()}`} rawValue={c.income} isEditing={isEditing} onChange={(v) => handleFormChange("AnnualIncome", "AnnualIncome", Number(v))} />
                                <InfoRow label="Account Type" value={c.accType} isEditing={isEditing} onChange={(v) => handleFormChange("Account Type", "accType", v)} />
                            </Section>
                        </div>

                        {/* CARD / DOCS */}
                        <div className="space-y-4 sm:space-y-6">
                            <Section title="Card Intelligence" icon={<CreditCard/>}>
                                <InfoRow label="Network" value={c.cardType} isEditing={isEditing} onChange={(v) => handleFormChange("Card Type", "cardType", v)} />
                                <InfoRow label="Spending Power" value={`₹${c.cardLimit.toLocaleString()}`} />
                            </Section>
                            
                            <div>
                                <h4 className="text-[8px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest sm:tracking-[0.3em] ml-1 sm:ml-2 mb-2 sm:mb-4">Verification Document</h4>
                                <div className="bg-slate-950 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden shadow-inner flex items-center justify-center min-h-[100px] sm:min-h-[200px]">
                                    {c.idProof ? (
                                        <img src={c.idProof} alt="ID Proof" className="w-full h-auto opacity-80" />
                                    ) : (
                                        <span className="text-slate-700 font-bold uppercase tracking-widest text-[8px] sm:text-xs">Imaging Offline</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helpers
function StatBox({ label, value, color, icon }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 p-3 sm:p-6 rounded-xl sm:rounded-[2rem] shadow-sm flex flex-col justify-center">
            <p className="text-[7px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest sm:tracking-[0.2em] mb-1 sm:mb-2 flex items-center gap-1.5">
                {React.cloneElement(icon, { className: "w-3 h-3 sm:w-4 sm:h-4 shrink-0" })} <span className="truncate">{label}</span>
            </p>
            <p className={`text-[15px] sm:text-2xl font-black italic tracking-tighter break-all ${color}`}>{value}</p>
        </div>
    );
}

function Section({ title, icon, children }) {
    return (
        <section>
            <h4 className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest sm:tracking-[0.3em] mb-2 sm:mb-4 ml-1">
                {React.cloneElement(icon, { className: "w-3 h-3 sm:w-4 sm:h-4 shrink-0" })} {title}
            </h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-3xl p-1 sm:p-2 shadow-inner">{children}</div>
        </section>
    );
}

function InfoRow({ label, value, isDanger, isEditing, onChange, rawValue }) {
    return (
        <div className="flex justify-between items-center p-2 sm:p-3.5 rounded-lg sm:rounded-xl hover:bg-white/5 transition-colors group gap-2">
            <span className="text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors w-1/3 truncate">{label}</span>
            {isEditing && onChange ? (
                <input 
                    type="text"
                    value={rawValue !== undefined ? rawValue : (value !== "—" && value !== "N/A" ? value : "")}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-[#0f1218] border border-indigo-500/50 text-[9px] sm:text-[11px] font-black font-mono tracking-tight text-slate-200 px-2 py-1.5 rounded w-2/3 text-right focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            ) : (
                <span className={`text-[8px] sm:text-[11px] font-black font-mono tracking-tight text-right w-2/3 truncate ${isDanger ? 'text-rose-500' : 'text-slate-200'}`}>{value || '—'}</span>
            )}
        </div>
    );
}