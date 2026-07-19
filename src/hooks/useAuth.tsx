import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { AuthContext } from './useAuthContext';

// Profile type from database
type Profile = Tables<'profiles'>;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUserId: string | null = null;

    const applySession = (session: Session | null, forceProfile = false) => {
      const nextUserId = session?.user?.id ?? null;
      setSession(session);
      // Só troca o objeto `user` quando o id muda de fato.
      // Evita re-render em cascata (ex.: TOKEN_REFRESHED ao voltar de outra
      // aba do navegador) que desmontava componentes filhos e resetava
      // estado local como abas selecionadas.
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
      } else if (forceProfile && session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session, true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      logger.error('Error fetching profile', error, {
        component: 'useAuth',
        action: 'fetchProfile',
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Limpa cache do TanStack Query ANTES do signOut para evitar refetches
    // com token ainda válido, e novamente DEPOIS para garantir estado zerado.
    queryClient.clear();
    await supabase.auth.signOut();
    queryClient.clear();
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsAdminLoading(false);
        return;
      }

      setIsAdminLoading(true);
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsAdmin(!!data);
      } catch (error) {
        logger.error('Error checking admin role', error, {
          component: 'useAuth',
          action: 'checkAdminRole',
        });
        setIsAdmin(false);
      } finally {
        setIsAdminLoading(false);
      }
    };

    checkAdminRole();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isAdminLoading,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
