import React, { useMemo, useState, useEffect } from 'react';
import { useBankData } from '../../hooks/useBankData';
import { useAdminActions } from '../../hooks/useAdminActions';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, addDoc, serverTimestamp, increment, 
  getDoc, getDocs // Added getDocs for the email search fallback
} from 'firebase/firestore';
import { userDB } from '../../firebaseUser';
import {
  CashStack, CheckCircle, XCircle, Person, PatchCheck, 
  ClockHistory, ChevronLeft, ChevronRight, CalendarWeek,
  ClipboardData, ArrowRightShort, Search, Funnel
} from 'react-bootstrap-icons';

export default function AdminLoans() {
  const { data, loading: dataLoading } = useBankData();
  const { overrides, updateLoan } = useAdminActions();
  const [pendingLoans, setPendingLoans] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    const q = query(collection(userDB, 'loanApplications'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = [];
      snapshot.forEach(doc => apps.push({ id: doc.id, ...doc.data() }));
      setPendingLoans(apps);
      setLoadingApps(false);
    }, (err) => {
      console.error("Firestore Listener Error:", err);
      setLoadingApps(false);
    });
    return () => unsubscribe();
  }, []);

  // UPDATED ACTION: Robust Approval with ID & Email Fallback
  const handleApprove = async (loan) => {
    const confirmApprove = window.confirm(`Approve loan of ₹${loan.amount?.toLocaleString()} for ${loan.userName}?`);
    if (!confirmApprove) return;

    try {
      // 1. DISBURSEMENT LOGIC: Find the user across both collections
      let finalUserRef = null;
      const collectionsToCheck = ['users', 'users1'];

      // ATTEMPT 1: Try direct Document ID lookup (UID)
      for (const colName of collectionsToCheck) {
        const directRef = doc(userDB, colName, loan.userId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          finalUserRef = directRef;
          break;
        }
      }

      // ATTEMPT 2: Fallback to searching by Email if UID lookup failed
      if (!finalUserRef && loan.userEmail) {
        console.log("UID lookup failed. Attempting email fallback...");
        for (const colName of collectionsToCheck) {
          const emailQuery = query(
            collection(userDB, colName), 
            where("Email", "==", loan.userEmail)
          );
          const querySnap = await getDocs(emailQuery);
          if (!querySnap.empty) {
            finalUserRef = querySnap.docs[0].ref;
            break;
          }
        }
      }

      // 2. Perform the actual update if user found
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

        // Sync with local admin state
        updateLoan(loan.userId, 'Approved');

        // Send user notification
        await addDoc(collection(userDB, 'notifications'), {
          userId: loan.userId,
          role: 'user',
          type: 'loan',
          message: `Your loan of ₹${loan.amount?.toLocaleString()} is approved and credited to your balance!`,
          read: false,
          redirectTo: '/user/loans',
          createdAt: serverTimestamp()
        });

        // Log the transaction
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

  const activeLoans = useMemo(() => {
    if (!data) return [];
    let processed = data
      .filter(c => {
        const hasLegacyLoan = c.raw?.['Loan Amount'] > 0;
        const hasApprovedOverride = overrides[c.customerId]?.loanStatus === 'Approved';
        return hasLegacyLoan || hasApprovedOverride;
      })
      .map(item => ({
        ...item,
        loanId: item.raw?.['Loan ID'] || 'N/A',
        loanAmount: item.raw?.['Loan Amount'] || 0,
        loanType: item.raw?.['Loan Type'] || 'Personal',
        status: overrides[item.customerId]?.loanStatus || item.raw?.['Loan Status'] || 'Current',
        tenure: item.raw?.['Loan Term'] || 0,
        interestRate: item.raw?.['Interest Rate'] || 0,
        outstanding: item.raw?.['Total_Loan_Outstanding'] || 0
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
  }, [data, overrides, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(activeLoans.length / ITEMS_PER_PAGE));
  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeLoans.slice(start, start + ITEMS_PER_PAGE);
  }, [activeLoans, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  if (dataLoading || loadingApps) return (
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
        <div className="lg:col-span-5 space-y-6 flex flex-col overflow-hidden">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Vetting Queue</h3>
          {pendingLoans.length === 0 ? (
            <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-12 text-center flex-1 flex flex-col items-center justify-center">
              <PatchCheck size={48} className="text-slate-800 mb-4" />
              <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">No Applications Pending</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3">
              {pendingLoans.map(loan => (
                <button
                  key={loan.id}
                  onClick={() => setSelectedLoan(loan)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                    selectedLoan?.id === loan.id 
                    ? 'bg-indigo-600 border-indigo-400 shadow-xl' 
                    : 'bg-slate-900/80 border-white/5 hover:border-indigo-500/50'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm text-white">{loan.userName}</div>
                    <div className="text-[10px] font-mono mt-1 text-slate-500">₹{loan.amount?.toLocaleString()}</div>
                  </div>
                  <ArrowRightShort size={24} className="text-slate-600" />
                </button>
              ))}
            </div>
          )}

          {selectedLoan && (
            <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex-shrink-0">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                <ClipboardData /> Reviewing Application
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <InfoItem icon={<Person />} val={selectedLoan.userName} />
                <InfoItem icon={<CashStack />} val={`₹${selectedLoan.amount?.toLocaleString()}`} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleApprove(selectedLoan)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase py-3.5 rounded-xl transition-all">
                  <CheckCircle size={14}/> Approve & Credit
                </button>
                <button onClick={() => handleReject(selectedLoan)} className="flex-1 bg-rose-600/10 text-rose-500 py-3.5 rounded-xl text-[10px] font-black uppercase">
                  <XCircle size={14}/> Reject
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 flex flex-col overflow-hidden">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Portfolio Inventory</h3>
          <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-white/[0.03] sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Customer</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Principal</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedLoans.map(l => (
                    <tr key={l.customerId} className="group hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-white">{l.fullName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-emerald-400">₹{Number(l.loanAmount).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4"><StatusPill status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl min-w-[150px]">
      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">{label}</p>
      <p className={`text-2xl font-mono font-black ${color}`}>{value}</p>
    </div>
  );
}

function InfoItem({ icon, val }) {
  return (
    <div className="bg-slate-950/50 border border-white/5 p-3 rounded-xl flex items-center gap-3">
      <span className="text-indigo-500">{icon}</span>
      <span className="text-[11px] font-bold text-slate-300 truncate">{val || 'N/A'}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const isApproved = status === 'Approved' || status === 'Current';
  return (
    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
      isApproved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    }`}>{status || 'Unknown'}</span>
  );
}