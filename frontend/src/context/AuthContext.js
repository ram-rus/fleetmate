import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid) {
    try {
      const { data } = await supabase.from('users').select('*').eq('id', uid).single();
      setProfile(data || null);
    } catch(e) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id); }
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id); }
      else { setUser(null); setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }

  return (
    <Ctx.Provider value={{
      user, profile, loading, login, logout,
      isAdmin: ['admin','supervisor','manager'].includes(profile?.role),
      isDriver: profile?.role === 'driver',
      isAdminOrAbove: ['admin','supervisor','manager'].includes(profile?.role),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
