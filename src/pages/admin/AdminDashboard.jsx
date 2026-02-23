import React, { useMemo, useState, useEffect } from 'react';
import { useBankData } from '../../hooks/useBankData';
import { useAdminActions } from '../../hooks/useAdminActions';
import DashboardCore from '../../components/admin/DashboardCore';
import { 
  ShieldCheck, 
  ArrowClockwise, 
  Activity,
  DatabaseFillCheck,
  CloudCheckFill,
  Search,
  CpuFill
} from 'react-bootstrap-icons';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc, 
  getDocs, // Added getDocs for fallback search
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { userDB } from '../../firebaseUser';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminDashboard() {
  const { data, loading: bankLoading, error } = useBankData();
  const { overrides, auditLogs } = useAdminActions();
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [cardApps, setCardApps] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(userDB, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingUsers(false);
    }, (err) => toast.error("User Sync Error"));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(userDB, 'creditCardApplications'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCardApps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingCards(false);
    }, (err) => toast.error("Card Sync Error"));
    return () => unsubscribe();
  }, []);

  /* -------------------- ADMINISTRATIVE ACTIONS -------------------- */

  const approveUser = async (userId) => {
    const tid = toast.loading("Authorizing account...");
    try {
      await updateDoc(doc(userDB, 'users', userId), { 
        status: 'approved', 
        approvalDate: serverTimestamp() 
      });
      toast.success("User access granted.", { id: tid });
    } catch (err) { toast.error("Approval failed.", { id: tid }); }
  };

  const rejectUser = async (userId) => {
    try {
      await updateDoc(doc(userDB, 'users', userId), { status: 'rejected' });
      toast.success("User application declined.");
    } catch (err) { toast.error("Rejection failed."); }
  };

  // ROBUST ACTION: Approve & Provision checking multiple collections and fallback ID
  const approveCard = async (appId) => {
    const tid = toast.loading("Resolving Registry & Provisioning...");
    try {
      const appRef = doc(userDB, 'creditCardApplications', appId);
      const appSnap = await getDoc(appRef);
      if (!appSnap.exists()) throw new Error("Application document vanished.");
      const appData = appSnap.data();

      // DISCOVERY LOGIC: Check 'users' and 'users1' by ID and Email
      let finalUserRef = null;
      const collectionsToCheck = ['users', 'users1'];

      // Attempt 1: Direct Document ID Lookup
      for (const col of collectionsToCheck) {
        const directRef = doc(userDB, col, appData.userId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          finalUserRef = directRef;
          break;
        }
      }

      // Attempt 2: Email Fallback (if ID lookup failed)
      if (!finalUserRef && appData.userEmail) {
        for (const col of collectionsToCheck) {
          const qEmail = query(collection(userDB, col), where("Email", "==", appData.userEmail));
          const qSnap = await getDocs(qEmail);
          if (!qSnap.empty) {
            finalUserRef = qSnap.docs[0].ref;
            break;
          }
        }
      }

      if (!finalUserRef) throw new Error("User record not found in registry.");

      // Generate Credentials
      const cardNumber = `4532 ${Math.floor(1000+Math.random()*8999)} ${Math.floor(1000+Math.random()*8999)} ${Math.floor(1000+Math.random()*8999)}`;
      const expiry = "02/31";
      const cvv = Math.floor(100 + Math.random()*899).toString();

      // Calculate credit limit based on card type and risk level
      const getCreditLimit = (cardType, riskLevel) => {
        const limits = {
          'Vajra Infinite Credit': { Low: 1000000, Medium: 750000, High: 500000 },
          'Vajra Premium Credit': { Low: 500000, Medium: 300000, High: 200000 },
          'Vajra Gold Credit': { Low: 200000, Medium: 150000, High: 100000 },
          'Vajra Cashback Credit': { Low: 150000, Medium: 100000, High: 75000 },
          'Vajra Credit Builder': { Low: 50000, Medium: 25000, High: 10000 }
        };
        return limits[cardType]?.[riskLevel] || 150000;
      };

      const creditLimit = getCreditLimit(appData.cardType, appData.riskLevel);

      // Step 1: Update Application Status
      await updateDoc(appRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        cardNumber, 
        expiry, 
        cvv,
        creditLimit
      });

      // Step 2: Inject into User Profile
      await updateDoc(finalUserRef, {
        cardId: cardNumber,
        cardType: appData.cardType || "Vajra Infinite",
        cardExpiry: expiry,
        cardCvv: cvv,
        creditLimit: creditLimit,
        creditBalance: 0,
        creditUtilization: 0
      });

      // Step 3: Notify User
      await addDoc(collection(userDB, 'notifications'), {
        userId: appData.userId,
        type: 'card_approved',
        message: `Your ${appData.cardType} has been approved! Credit limit: ₹${creditLimit.toLocaleString()}`,
        createdAt: serverTimestamp(),
        read: false
      });

      toast.success("Provisioning successful!", { id: tid });
    } catch (err) { 
      console.error("Critical Provisioning Failure:", err);
      toast.error(`Failed: ${err.message}`, { id: tid }); 
    }
  };

  const rejectCard = async (appId) => {
    const tid = toast.loading("Processing rejection...");
    try {
      // Get application data first
      const appRef = doc(userDB, 'creditCardApplications', appId);
      const appSnap = await getDoc(appRef);
      if (!appSnap.exists()) throw new Error("Application not found");
      
      const appData = appSnap.data();
      
      // Update application status
      await updateDoc(appRef, { 
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });
      
      // Notify user
      await addDoc(collection(userDB, 'notifications'), {
        userId: appData.userId,
        type: 'card_rejected',
        message: `Your ${appData.cardType} application has been declined. You can reapply later.`,
        createdAt: serverTimestamp(),
        read: false
      });
      
      toast.success("Application rejected.", { id: tid });
    } catch (err) { 
      console.error(err);
      toast.error("Rejection failed.", { id: tid }); 
    }
  };

  /* -------------------- DATA PROCESSING -------------------- */

  const processedData = useMemo(() => {
    if (!data) return [];
    let filtered = data;
    if (searchTerm.trim() !== "") {
      filtered = data.filter(item => 
        item.customerId?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered.map(item => {
      const override = overrides[item.customerId];
      return override ? {
        ...item,
        isFrozen: override.isFrozen ?? item.isFrozen,
        isHighRisk: override.flagged === true ? true : item.isHighRisk
      } : item;
    });
  }, [data, overrides, searchTerm]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans antialiased">
      <Toaster position="top-right" />
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <DatabaseFillCheck size={14} /> DB Status: Connected
            </div>
            <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <CloudCheckFill size={14} /> Nexus Nodes: Online
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <Activity size={12} className="text-emerald-500" />
            Live OPS: {new Date().toLocaleTimeString()}
          </div>
        </div>

        <header className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CpuFill className="text-blue-500" />
              <span className="text-blue-500 font-black text-xs uppercase tracking-[0.3em]">Command Center</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Vajra <span className="text-slate-500">Control</span></h1>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative group w-full sm:w-64 lg:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400" size={14} />
              <input type="text" placeholder="Search Identity..." className="bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs font-bold w-full focus:border-blue-500/50 transition-all text-white outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => window.location.reload()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg whitespace-nowrap"><ArrowClockwise /> Refresh</button>
          </div>
        </header>

        <main className="relative bg-[#0b1120]/80 border border-white/10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
           <DashboardCore
             role="ADMIN"
             data={processedData}
             pendingUsers={pendingUsers}
             loadingUsers={loadingUsers}
             approveUser={approveUser}
             rejectUser={rejectUser}
             cardApps={cardApps}
             loadingCards={loadingCards}
             approveCard={approveCard}
             rejectCard={rejectCard}
             auditLogs={auditLogs}
           />
        </main>
      </div>
    </div>
  );
}