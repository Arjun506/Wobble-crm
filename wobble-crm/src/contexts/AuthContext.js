import React, { createContext, useState, useContext, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const deriveRoleFromEmail = (email) => {
  if (!email) return 'callcenter';
  const prefix = email.split('@')[0].toLowerCase();
  const knownRoles = ['callcenter', 'service', 'warehouse', 'manager', 'tl', 'admin', 'sales'];
  return knownRoles.includes(prefix) ? prefix : 'callcenter';
};

async function fetchUserProfile(email) {
  if (!email) return null;
  try {
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(usersQuery);
    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        email: userData.email,
        name: userData.name || email.split('@')[0],
        role: userData.role || deriveRoleFromEmail(email),
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
  return {
    id: null,
    email,
    name: email.split('@')[0],
    role: deriveRoleFromEmail(email),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.email);
        const currentUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: profile?.name || firebaseUser.email?.split('@')[0],
          role: profile?.role || deriveRoleFromEmail(firebaseUser.email),
        };
        setUser(currentUser);
        setRole(currentUser.role);
        localStorage.setItem('wobbleUser', JSON.stringify(currentUser));
      } else {
        setUser(null);
        setRole(null);
        localStorage.removeItem('wobbleUser');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const profile = await fetchUserProfile(firebaseUser.email);
      const currentUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: profile?.name || firebaseUser.email?.split('@')[0],
        role: profile?.role || deriveRoleFromEmail(firebaseUser.email),
      };

      setUser(currentUser);
      setRole(currentUser.role);
      localStorage.setItem('wobbleUser', JSON.stringify(currentUser));

      toast.success('Welcome ' + currentUser.name);
      return { success: true, role: currentUser.role };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed. Please check your email/password.' };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setRole(null);
    localStorage.removeItem('wobbleUser');
    toast.success('Logged out');
    window.location.href = '/login';
  };

  const value = { user, role, login, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
