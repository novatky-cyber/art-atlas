import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Auth {
  ready: boolean;
  session: Session | null;
  owner: boolean | null; // null = 確認中
  signOut: () => Promise<void>;
}
const Ctx = createContext<Auth>({ ready: false, session: null, owner: null, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [owner, setOwner] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      // PKCE のコード付き URL を掃除（ハッシュルートは残す）
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setOwner(null);
      return;
    }
    // 最初にログインした人を持ち主として登録（以後は持ち主だけが読み書き可能）
    supabase.rpc('claim_owner').then(({ data, error }) => setOwner(error ? false : Boolean(data)));
  }, [session?.user.id]);

  return (
    <Ctx.Provider value={{ ready, session, owner, signOut: async () => void (await supabase.auth.signOut()) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
