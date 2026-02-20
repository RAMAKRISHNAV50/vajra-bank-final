import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { userDB } from '../firebaseUser';

export const useCurrentUser = () => {
    const { user: authUser } = useAuth();
    const [firestoreData, setFirestoreData] = useState({});
    const [loading, setLoading] = useState(true);

    // REAL-TIME LISTENER: Sync with Firestore immediately when database changes
    useEffect(() => {
        if (!authUser?.uid) {
            setLoading(false);
            return;
        }

        // Watch the 'users' collection for this specific UID
        const userRef = doc(userDB, 'users', authUser.uid);
        
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setFirestoreData(docSnap.data());
            }
            setLoading(false);
        }, (err) => {
            console.error("Firestore sync error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authUser]);

    const updateUserProfile = async (updates) => {
        if (!authUser?.uid) return;
        try {
            const userRef = doc(userDB, 'users', authUser.uid);
            await updateDoc(userRef, updates);
            // No need to set local state; onSnapshot will catch the change automatically
        } catch (err) {
            console.error("Failed to sync updates", err);
        }
    };

    const currentUser = useMemo(() => {
        if (!authUser) return null;

        // Combine Auth state with the Live Firestore data
        const merged = { ...authUser, ...firestoreData };

        return {
            ...merged,
            // Ensure card data is prioritized for the UI switch
            cardId: merged.cardId || null,
            firstName: merged.firstName || merged["First Name"] || merged.displayName?.split(' ')[0] || 'User',
            lastName: merged.lastName || merged["Last Name"] || '',
            fullName: merged.fullName || `${merged.firstName || 'User'} ${merged.lastName || ''}`.trim(),
            balance: merged.balance || merged.Account_Balance || 0,
            kycStatus: merged.kycStatus || 'Verified',
            accountStatus: merged.activeStatus || merged.ActiveStatus || 'Active'
        };
    }, [authUser, firestoreData]);

    return {
        currentUser,
        loading,
        updateUserProfile
    };
};