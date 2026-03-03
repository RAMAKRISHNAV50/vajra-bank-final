import React, { useState, useEffect, useMemo } from 'react';
import { Eye, ChevronLeft, ChevronRight, Search, XCircle, CloudSlash, ShieldExclamation } from 'react-bootstrap-icons';
import { collection, getDocs } from 'firebase/firestore';
import { userDB } from '../../firebaseUser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export default function CustomerTable({ onView }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRisk, setSelectedRisk] = useState("All Risks");
    const [currentPage, setCurrentPage] = useState(1);
    const [backendStatus, setBackendStatus] = useState("online");
    const rowsPerPage = 50;

    useEffect(() => {
        const fetchCombinedData = async () => {
            try {
                // 1. Get Identity Data from Firebase first
                const [legacySnap, newSnap] = await Promise.all([
                    getDocs(collection(userDB, 'users1')),
                    getDocs(collection(userDB, 'users'))
                ]);

                const existingUsers = legacySnap.docs.map(doc => ({
                    ...doc.data(), id: doc.id, isNewUser: false
                }));

                const newUsers = newSnap.docs.map(doc => ({
                    ...doc.data(), id: doc.id, isNewUser: true
                }));

                // 2. Map data for UI display and ML Model requirements
                const allFirebaseUsers = [...existingUsers, ...newUsers].map(u => ({
                    // UI and Search fields
                    id: u.id,
                    isNewUser: u.isNewUser,
                    customerId: u["Customer ID"] || u.customerId || u.uid || u.id,
                    fullName: u.fullName || `${u["First Name"] || u.firstName || ''} ${u["Last Name"] || u.lastName || ''}`.trim(),
                    email: u.Email || u.email || 'N/A',
                    activeStatus: u.ActiveStatus || u.activeStatus || u.status || 'Active',

                    // STRICT ML FEATURE MAPPING (26 Fields)
                    // Inside fetchCombinedData .map() function
                    mlFeatures: {
                        'Age': Number(u.Age || 0),
                        'Gender': u.Gender || 'Unknown',
                        'Account Type': u["Account Type"] || 'Savings',
                        'Relationship_Tenure_Years': Number(u.Relationship_Tenure_Years || u.Tenure || 0),
                        'Account Balance': Number(u["Account Balance"] || u.balance || 0),
                        'Avg_Account_Balance': Number(u.Avg_Account_Balance || 0),
                        'AnnualIncome': Number(u.AnnualIncome || 0),
                        'Monthly_Transaction_Count': Number(u.Monthly_Transaction_Count || 0),
                        'Avg_Transaction_Amount': Number(u.Avg_Transaction_Amount || 0),
                        'Digital_Transaction_Ratio': Number(u.Digital_Transaction_Ratio || 0),
                        'Days_Since_Last_Transaction': Number(u.Days_Since_Last_Transaction || 0),
                        'Loan Amount': Number(u["Loan Amount"] || 0),
                        'Loan Type': u["Loan Type"] || 'None',
                        'Loan Term': Number(u["Loan Term"] || 0),
                        'Interest Rate': Number(u["Interest Rate"] || 0),
                        'Active_Loan_Count': Number(u.Active_Loan_Count || 0),
                        'Credit Utilization': Number(u["Credit Utilization"] || 0),
                        'Avg_Credit_Utilization': Number(u.Avg_Credit_Utilization || 0),
                        'Card_Balance_to_Limit_Ratio': Number(u.Card_Balance_to_Limit_Ratio || 0),
                        'Payment Delay Days': Number(u["Payment Delay Days"] || 0),
                        'CIBIL_Score': Number(u.CIBIL_Score || 0),
                        'Card Type': u["Card Type"] || 'None',
                        'Credit Limit': Number(u["Credit Limit"] || 0),
                        'Rewards Points': Number(u["Rewards Points"] || 0),
                        'Reward_Points_Earned': Number(u.Reward_Points_Earned || 0),
                        'ActiveStatus': u.ActiveStatus || 'Active'
                    }
                }));

                let riskProfiles = [];
                let isOffline = false;

                // 3. Filter legacy users and send only mlFeatures to backend
                const usersToPredict = allFirebaseUsers
                    .filter(u => !u.isNewUser)
                    .map(u => ({
                        customerId: u.customerId,
                        ...u.mlFeatures
                    }));

                if (usersToPredict.length > 0) {
                    try {
                        const response = await fetch('https://vajra-bank-backend.onrender.com/api/predict-risk-batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(usersToPredict)
                        });

                        if (response.ok) {
                            const backendResult = await response.json();
                            if (backendResult.success) {
                                riskProfiles = backendResult.predictions;
                                setBackendStatus("online");
                            }
                        } else {
                            isOffline = true;
                            setBackendStatus("offline");
                        }
                    } catch (err) {
                        isOffline = true;
                        setBackendStatus("offline");
                    }
                }

                // 4. Merge predictions back
                const mergedData = allFirebaseUsers.map(user => {
                    if (user.isNewUser) return { ...user, riskLevel: 'Not Applicable' };
                    if (isOffline) return { ...user, riskLevel: 'Server Offline' };

                    const riskMatch = riskProfiles.find(r => String(r.customerId) === String(user.customerId));
                    return { ...user, riskLevel: riskMatch ? riskMatch.riskLevel : 'Pending' };
                });

                setData(mergedData);
            } catch (err) {
                console.error("Critical Data Sync Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCombinedData();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesRisk = selectedRisk === "All Risks" || item.riskLevel === selectedRisk;
            return matchesSearch && matchesRisk;
        });
    }, [data, searchTerm, selectedRisk]);

    const kpis = useMemo(() => [
        { name: 'Total Users', count: data.length, color: '#3b82f6' },
        { name: 'High Value', count: data.filter(c => c.riskLevel === 'High').length, color: '#10b981' },
        { name: 'Medium Value', count: data.filter(c => c.riskLevel === 'Medium').length, color: '#fbbf24' },
        { name: 'Low Value', count: data.filter(c => c.riskLevel === 'Low').length, color: '#f43f5e' }
    ], [data]);

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    if (loading) return (
        <div className="p-20 flex flex-col items-center justify-center bg-[#0a0c10] min-h-screen">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-mono animate-pulse tracking-widest text-[10px]">Processing Node Intelligence</p>
        </div>
    );

    return (
        <div className="p-4 sm:p-8 bg-[#0a0c10] min-h-screen text-white font-sans">

            {/* AI DISCLAIMER BANNER */}
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-start gap-4 text-amber-400 shadow-lg">
                <ShieldExclamation size={24} className="shrink-0" />
                <div>
                    <h3 className="font-bold text-xs uppercase tracking-widest">AI Prediction Disclaimer</h3>
                    <p className="text-[11px] opacity-80 mt-1">Our AI can make mistakes. Predictions are based on historical data patterns. Consult a bank authority for exact status profiles.</p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-[#0f1218] p-4 rounded-xl border border-white/5">
                <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs focus:border-indigo-500 outline-none transition-all"
                        placeholder="Search Identity Vault..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <select
                    value={selectedRisk}
                    onChange={(e) => { setSelectedRisk(e.target.value); setCurrentPage(1); }}
                    className="bg-[#161b22] border border-white/10 text-xs font-bold uppercase rounded-lg px-4 py-2 outline-none hover:border-indigo-500 cursor-pointer"
                >
                    <option value="All Risks">Filter: All Risks</option>
                    <option value="High">High Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="Low">Low Risk</option>
                    <option value="Not Applicable">Not Applicable</option>
                </select>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {kpis.map(kpi => (
                    <div key={kpi.name} className="bg-[#0f1218] border border-white/5 p-6 rounded-[2rem] shadow-xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.name}</p>
                        <p className="text-3xl font-bold mt-2 font-mono" style={{ color: kpi.color }}>{kpi.count.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* CHART & ANALYTICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                <div className="bg-[#0f1218] border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Identity Match Frequency</p>
                    <p className="text-6xl font-black text-indigo-500 tracking-tighter">{filteredData.length}</p>
                    <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase">Filtered Records Found</p>
                </div>
                <div className="lg:col-span-2 bg-[#0f1218] border border-white/5 p-6 rounded-[2.5rem] h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpis.slice(1)}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis hide={true} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#161b22', border: 'none', borderRadius: '8px' }} />
                            <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={40}>
                                {kpis.slice(1).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* DATA TABLE */}
            <div className="bg-[#0f1218]/50 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Entity ID</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Full Identity</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Risk Profile</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Vault Access</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {currentRows.map(customer => (
                                <tr key={customer.customerId} className="hover:bg-indigo-500/[0.04] transition-colors group">
                                    <td className="px-8 py-5 font-mono text-[11px] text-indigo-400/60">{customer.customerId}</td>
                                    <td className="px-8 py-5">
                                        <div className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase italic">{customer.fullName}</div>
                                        <div className="text-[10px] text-slate-500 font-mono tracking-tighter">{customer.email}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit shadow-sm border ${customer.riskLevel === 'High' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
                                                    customer.riskLevel === 'Medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                                                        customer.riskLevel === 'Low' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' :
                                                            'text-slate-500 border-slate-500/20 bg-slate-500/5'
                                                }`}>
                                                {customer.riskLevel === 'Not Applicable' ? 'NEW ENTITY' : `${customer.riskLevel} Profile`}
                                            </span>
                                            <p className="text-[7px] font-bold uppercase tracking-widest text-indigo-400/80">
                                                {customer.isNewUser ? 'Prediction displayed next 30 days' : 'Update cycle: 30 days'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-1.5 w-1.5 rounded-full ${customer.activeStatus === 'Active' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-700'}`}></div>
                                            <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">{customer.activeStatus}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button onClick={() => onView(customer)} className="bg-indigo-600/10 text-indigo-400 p-2.5 rounded-xl hover:bg-indigo-600 hover:text-white border border-indigo-500/20 transition-all active:scale-90">
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="px-8 py-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Showing <span className="text-indigo-400">{indexOfFirstRow + 1}</span> - <span className="text-indigo-400">{Math.min(indexOfLastRow, filteredData.length)}</span> of {filteredData.length} Registry Items
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-3 bg-slate-900 border border-white/10 rounded-xl disabled:opacity-20 hover:bg-slate-800 transition-all"><ChevronLeft size={12} /></button>
                        <div className="bg-slate-900 px-4 py-2 border border-white/10 rounded-xl text-xs font-mono font-bold text-white tracking-widest">{currentPage} / {totalPages}</div>
                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-3 bg-slate-900 border border-white/10 rounded-xl disabled:opacity-20 hover:bg-slate-800 transition-all"><ChevronRight size={12} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}