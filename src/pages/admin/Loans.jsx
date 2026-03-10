import React, { useMemo, useState, useEffect } from 'react';
import { useAdminActions } from '../../hooks/useAdminActions';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, addDoc, serverTimestamp, increment, 
  getDoc, getDocs 
} from 'firebase/firestore';
import { userDB } from '../../firebaseUser';
import {
  CashStack, CheckCircle, XCircle, Person, PatchCheck, 
  ArrowRightShort, ClipboardData, Bank, ClockHistory,Funnel, TextParagraph
} from 'react-bootstrap-icons';

export default function AdminLoans() {
  const { overrides, updateLoan } = useAdminActions();
  const [pendingLoans, setPendingLoans] = useState([]);
  
  // Data States
  const [legacyUsers, setLegacyUsers] = useState([]);
  const [newUsers, setNewUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // 1. Fetch Pending Applications
  useEffect(() => {
    const q = query(collection(userDB, 'loanApplications'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = [];
      snapshot.forEach(doc => apps.push({ id: doc.id, ...doc.data() }));
      setPendingLoans(apps);
    }, (err) => console.error("Applications Listener Error:", err));
    return () => unsubscribe();
  }, []);

  // 2. Fetch ALL Users (Legacy & New) for the Active Portfolio
  useEffect(() => {
    // Fetch Legacy Users
    const unsubLegacy = onSnapshot(collection(userDB, "users1"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, source: 'legacy', ...doc.data() }));
      setLegacyUsers(data);
    });

    // Fetch New Users
    const unsubNew = onSnapshot(collection(userDB, "users"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, source: 'new', ...doc.data() }));
      setNewUsers(data);
      setLoadingData(false); // Assume done when the newer collection resolves
    });

    return () => { unsubLegacy(); unsubNew(); };
  }, []);

  // 3. Robust Approval with ID & Email Fallback
  const handleApprove = async (loan) => {
    const confirmApprove = window.confirm(`Approve loan of ₹${loan.amount?.toLocaleString()} for ${loan.userName}?`);
    if (!confirmApprove) return;

    try {
      let finalUserRef = null;
      const collectionsToCheck = ['users', 'users1'];

      for (const colName of collectionsToCheck) {
        const directRef = doc(userDB, colName, loan.userId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          finalUserRef = directRef;
          break;
        }
      }

      if (!finalUserRef && loan.userEmail) {
        console.log("UID lookup failed. Attempting email fallback...");
        for (const colName of collectionsToCheck) {
          const emailQuery = query(
            collection(userDB, colName), 
            where("Email", "==", loan.userEmail)
          );
          // Also check lowercase 'email' field just in case
          const emailQueryLower = query(
            collection(userDB, colName), 
            where("email", "==", loan.userEmail)
          );
          
          let querySnap = await getDocs(emailQuery);
          if (querySnap.empty) querySnap = await getDocs(emailQueryLower);

          if (!querySnap.empty) {
            finalUserRef = querySnap.docs[0].ref;
            break;
          }
        }
      }

      if (finalUserRef) {
        // Update application status
        await updateDoc(doc(userDB, 'loanApplications', loan.id), {
          status: 'approved',
          expectedDisbursementDays: 0,
          approvedAt: serverTimestamp()
        });

        // Credit the account balance atomically
        await updateDoc(finalUserRef, {
          "Account Balance": increment(loan.amount)
        });

        updateLoan(loan.userId, 'Approved');

        await addDoc(collection(userDB, 'notifications'), {
          userId: loan.userId,
          role: 'user',
          type: 'loan',
          message: `Your loan of ₹${loan.amount?.toLocaleString()} is approved and credited to your balance!`,
          read: false,
          redirectTo: '/user/loans',
          createdAt: serverTimestamp()
        });

        await addDoc(collection(userDB, 'transfer'), {
          senderEmail: loan.userEmail,
          amount: loan.amount,
          type: 'Deposit',
          reason: `Loan Disbursement: ${loan.loanType}`,
          timestamp: serverTimestamp()
        });

        setSelectedLoan(null);
        alert("Success: Loan approved and registry updated via discovery.");
      } else {
        throw new Error(`Registry Mismatch: No user found for ID ${loan.userId} or Email ${loan.userEmail}`);
      }

    } catch (err) {
      console.error("Critical Approval Error:", err);
      alert("Approval flow failed: " + err.message);
    }
  };

  const handleReject = async (loan) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    try {
      await updateDoc(doc(userDB, 'loanApplications', loan.id), {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: serverTimestamp()
      });
      
      updateLoan(loan.userId, 'Rejected');
      
      await addDoc(collection(userDB, 'notifications'), {
        userId: loan.userId,
        role: 'user',
        type: 'loan',
        message: `Your loan application was rejected: ${reason}`,
        read: false,
        redirectTo: '/user/loans',
        createdAt: serverTimestamp()
      });
      setSelectedLoan(null);
    } catch (err) {
      alert("Error rejecting loan");
    }
  };

  // 4. Combine Legacy & New Users for the Portfolio Table
  const activeLoans = useMemo(() => {
    const allUsers = [...legacyUsers, ...newUsers];
    
    let processed = allUsers
      .filter(u => {
        const hasLegacyLoan = (u['Loan Amount'] > 0 || u.loanAmount > 0);
        const hasApprovedOverride = overrides[u['Customer ID'] || u.customerId]?.loanStatus === 'Approved';
        return hasLegacyLoan || hasApprovedOverride;
      })
      .map(item => ({
        ...item,
        fullName: item.fullName || `${item["First Name"] || ""} ${item["Last Name"] || ""}`.trim() || item.Email || item.email,
        customerId: item['Customer ID'] || item.customerId || item.id,
        loanId: item['Loan ID'] || item.loanId || 'N/A',
        loanAmount: item['Loan Amount'] || item.loanAmount || 0,
        loanType: item['Loan Type'] || item.loanType || 'Personal',
        status: overrides[item['Customer ID'] || item.customerId]?.loanStatus || item['Loan Status'] || item.loanStatus || 'Current',
      }));

    if (statusFilter !== "ALL") {
      processed = processed.filter(l => l.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      processed = processed.filter(l => 
        l.fullName?.toLowerCase().includes(term) ||
        l.loanId?.toLowerCase().includes(term) ||
        l.loanType?.toLowerCase().includes(term)
      );
    }
    return processed;
  }, [legacyUsers, newUsers, overrides, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(activeLoans.length / ITEMS_PER_PAGE));
  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeLoans.slice(start, start + ITEMS_PER_PAGE);
  }, [activeLoans, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  if (loadingData) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
      <div className="text-indigo-500 font-mono tracking-widest uppercase text-xs">Unlocking Loan Vault...</div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-[#020617] text-slate-100 flex flex-col overflow-hidden font-sans">
      <header className="px-6 lg:px-10 pt-6 lg:pt-10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 flex-shrink-0">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-3 italic">
            <CashStack className="text-indigo-500" /> Loan Center
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Internal Credit Control & Disbursement</p>
        </div>
        <div className="flex gap-4">
          <StatBadge label="Queue" value={pendingLoans.length} color="text-amber-500" />
          <StatBadge label="Active Portfolio" value={activeLoans.length} color="text-indigo-500" />
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 lg:px-10 pb-10 overflow-hidden">
        
        {/* LEFT COLUMN: VETTING QUEUE */}
        <div className="lg:col-span-5 space-y-6 flex flex-col overflow-hidden h-full">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 shrink-0">Vetting Queue</h3>
          
          {!selectedLoan ? (
            // QUEUE LIST
            pendingLoans.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-12 text-center flex-1 flex flex-col items-center justify-center">
                <PatchCheck size={48} className="text-slate-800 mb-4" />
                <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">No Applications Pending</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {pendingLoans.map(loan => (
                  <button
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan)}
                    className="w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between group bg-slate-900/80 border-white/5 hover:border-indigo-500/50 hover:bg-slate-900"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">{loan.userName}</div>
                      <div className="text-[10px] font-mono mt-1 text-slate-500">
                        {loan.loanType} • ₹{loan.amount?.toLocaleString()}
                      </div>
                    </div>
                    <ArrowRightShort size={24} className="text-indigo-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            )
          ) : (
            // SELECTED APPLICATION VIEW
            <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl flex flex-col h-full overflow-y-auto">
              <div className="flex justify-between items-start mb-6 shrink-0">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <ClipboardData /> Reviewing Application
                </h4>
                <button 
                  onClick={() => setSelectedLoan(null)}
                  className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Back to Queue
                </button>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem icon={<Person />} label="Applicant" val={selectedLoan.userName} />
                  <InfoItem icon={<CashStack />} label="Requested" val={`₹${selectedLoan.amount?.toLocaleString()}`} className="text-emerald-400 font-mono font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem icon={<Bank />} label="Loan Type" val={selectedLoan.loanType} />
                  <InfoItem icon={<ClockHistory />} label="Tenure" val={`${selectedLoan.tenureMonths} Months`} />
                </div>
                
                {/* NEW REASON SECTION */}
                <div className="bg-slate-950/50 border border-white/5 p-4 rounded-xl mt-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <TextParagraph size={14} className="text-indigo-400" />
                    Stated Purpose / Reason
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/50 pl-3 py-1">
                    "{selectedLoan.reason || 'No specific reason provided.'}"
                  </p>
                </div>
              </div>

              <div className="flex gap-3 shrink-0">
                <button onClick={() => handleApprove(selectedLoan)} className="flex-1 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
                  <CheckCircle size={14}/> Approve & Credit
                </button>
                <button onClick={() => handleReject(selectedLoan)} className="flex-1 flex justify-center items-center gap-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 py-4 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95">
                  <XCircle size={14}/> Reject
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PORTFOLIO */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden h-full">
          <div className="flex justify-between items-end shrink-0 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Portfolio Inventory</h3>
          </div>
          
          <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 flex gap-4">
              <input 
                type="text" 
                placeholder="Search user or loan ID..."
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500 flex-1"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select 
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300 outline-none focus:border-indigo-500 appearance-none min-w-[120px]"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="Current">Current</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-white/[0.03] sticky top-0 backdrop-blur-md z-10">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Customer</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Type</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 text-right">Principal</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedLoans.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12 text-slate-500 text-sm italic">No active portfolio records match your criteria.</td>
                    </tr>
                  ) : (
                    paginatedLoans.map(l => (
                      <tr key={l.customerId} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-white">{l.fullName}</div>
                          <div className="text-[9px] text-slate-500 uppercase tracking-widest">{l.source} profile</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-300">{l.loanType}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-sm font-bold text-emerald-400">₹{Number(l.loanAmount).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 text-center"><StatusPill status={l.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-center gap-2 shrink-0">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-2 bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 text-white"
                >Prev</button>
                <span className="px-4 py-2 text-xs font-mono text-slate-400">Page {currentPage} of {totalPages}</span>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-2 bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 text-white"
                >Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function StatBadge({ label, value, color }) {
  return (
    <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl min-w-[140px] shadow-lg">
      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">{label}</p>
      <p className={`text-2xl font-mono font-black ${color}`}>{value}</p>
    </div>
  );
}

function InfoItem({ icon, label, val, className = "text-slate-200" }) {
  return (
    <div className="bg-slate-950/50 border border-white/5 p-4 rounded-xl flex items-start gap-3">
      <div className="text-indigo-500 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-xs truncate ${className}`}>{val || 'N/A'}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const isApproved = status === 'Approved' || status === 'Current';
  const isPending = status === 'Pending' || status === 'pending';
  
  let colors = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  if (isApproved) colors = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (isPending) colors = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'Rejected') colors = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${colors}`}>
      {status || 'Unknown'}
    </span>
  );
}