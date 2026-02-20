import React, { useState, useEffect } from 'react';
import { 
    collection, query, where, onSnapshot, doc, 
    updateDoc, getDoc, getDocs, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { userDB } from '../../firebaseUser';
import { 
    CreditCard as CardIcon, CheckCircleFill, XCircleFill, 
    PersonBadge, Search, EnvelopeAt, Wallet2 
} from 'react-bootstrap-icons';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminCardManager() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const q = query(collection(userDB, 'creditCardApplications'), where('status', '==', 'pending'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribe();
    }, []);

    // Action: Approve & Provision
    const approveCard = async (app) => {
        const tid = toast.loading(`Resolving registry for ${app.userName}...`);
        try {
            let finalUserRef = null;
            const collections = ['users', 'users1'];

            // STEP 1: Try Direct UID Lookup
            for (const col of collections) {
                const directRef = doc(userDB, col, app.userId);
                const snap = await getDoc(directRef);
                if (snap.exists()) {
                    finalUserRef = directRef;
                    break;
                }
            }

            // STEP 2: Fallback to Email Lookup (Robust Fix)
            if (!finalUserRef && app.userEmail) {
                console.log("UID Mismatch. Searching by Email fallback...");
                for (const col of collections) {
                    const qEmail = query(collection(userDB, col), where("Email", "==", app.userEmail));
                    const qSnap = await getDocs(qEmail);
                    if (!qSnap.empty) {
                        finalUserRef = qSnap.docs[0].ref;
                        break;
                    }
                }
            }

            if (!finalUserRef) throw new Error("Applicant not found in any database collection.");

            // STEP 3: Generate Credentials
            const cardNumber = `4532 ${Math.floor(1000+Math.random()*8999)} ${Math.floor(1000+Math.random()*8999)} ${Math.floor(1000+Math.random()*8999)}`;
            const expiry = "02/31";
            const cvv = Math.floor(100 + Math.random()*899).toString();

            // STEP 4: Update Registry Application
            await updateDoc(doc(userDB, 'creditCardApplications', app.id), {
                status: 'approved',
                approvedAt: serverTimestamp(),
                cardNumber, expiry, cvv
            });

            // STEP 5: Inject into User Profile
            // FIXED: Changed 'cardCvv' to 'cvv' to match user-side component expectations
            await updateDoc(finalUserRef, {
                cardId: cardNumber,
                cardType: app.cardType || "Vajra Infinite",
                cardExpiry: expiry,
                cvv: cvv, 
                creditLimit: 150000,
                creditBalance: 0,
                creditUtilization: 0
            });

            await addDoc(collection(userDB, 'notifications'), {
                userId: app.userId,
                type: 'card',
                message: `Your ${app.cardType} has been provisioned!`,
                createdAt: serverTimestamp(),
                read: false
            });

            toast.success("Card Active & Synced!", { id: tid });
        } catch (err) {
            console.error("Provisioning Error Details:", err);
            toast.error(`Error: ${err.message}`, { id: tid });
        }
    };

    const rejectCard = async (appId) => {
        if (!window.confirm("Reject application?")) return;
        try {
            await updateDoc(doc(userDB, 'creditCardApplications', appId), { status: 'rejected' });
            toast.success("Application Denied");
        } catch (err) { toast.error("Action Failed"); }
    };

    const filteredApps = applications.filter(app => 
        app.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-20 text-center text-blue-500 font-black">SYNCING NEXUS...</div>;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10 font-sans">
            <Toaster position="top-right" />
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                        <CardIcon className="text-blue-500" /> Card Provisioning
                    </h1>
                </div>
                <div className="relative group w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search applicant..." 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs font-bold outline-none focus:border-blue-500/50 transition-all" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
            </header>

            <div className="space-y-4">
                {filteredApps.map((app) => (
                    <div key={app.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 flex justify-between items-center hover:border-blue-500/30 transition-all group">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center font-black text-blue-400 border border-blue-500/20 text-xl italic uppercase">
                                {(app.userName || 'V')[0]}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-white">{app.userName}</h4>
                                <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><EnvelopeAt /> {app.userEmail}</p>
                            </div>
                        </div>

                        <div className="flex gap-10 items-center">
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Type</p>
                                <p className="text-xs font-bold text-blue-400">{app.cardType}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Income</p>
                                <p className="text-xs font-bold text-emerald-400">₹{Number(app.income).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => approveCard(app)} 
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95"
                                >
                                    Issue Card
                                </button>
                                <button 
                                    onClick={() => rejectCard(app.id)} 
                                    className="px-4 py-2.5 bg-slate-800 text-slate-400 hover:text-red-400 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    Deny
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredApps.length === 0 && (
                    <div className="p-20 text-center bg-slate-900/50 rounded-3xl border border-dashed border-white/5 text-slate-600 font-bold uppercase text-xs">
                        Queue Clear
                    </div>
                )}
            </div>
        </div>
    );
}