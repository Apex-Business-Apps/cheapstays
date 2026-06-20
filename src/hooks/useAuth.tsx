/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchRoles, type AppRole } from "@/lib/rbac";
import { hasRequiredSignupConsent } from "@/lib/legal-consent";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  rolesError: string | null;
  loading: boolean;
  consentReady: boolean;
  consentRequired: boolean;
  signOut: () => Promise<void>;
  refreshConsent: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  roles: [],
  rolesError: null,
  loading: true,
  consentReady: false,
  consentRequired: false,
  signOut: async () => {},
  refreshConsent: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentReady, setConsentReady] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);

  const loadRoles = async (userId: string | undefined) => {
    const result = await fetchRoles(userId);
    setRoles(result.roles);
    setRolesError(result.error?.message ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          void loadRoles(s.user.id);
          void hasRequiredSignupConsent(s.user.id).then((ok) => {
            setConsentRequired(!ok);
            setConsentReady(true);
          }).catch(() => {
            setConsentRequired(true);
            setConsentReady(true);
          });
        }, 0);
      } else {
        setRoles([]);
        setRolesError(null);
        setConsentRequired(false);
        setConsentReady(true);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadRoles(data.session?.user?.id);
      if (data.session?.user?.id) {
        try {
          const ok = await hasRequiredSignupConsent(data.session.user.id);
          setConsentRequired(!ok);
        } catch {
          setConsentRequired(true);
        }
      }
      setConsentReady(true);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshConsent = async () => {
    if (!user?.id) {
      setConsentRequired(false);
      setConsentReady(true);
      return;
    }
    try {
      const ok = await hasRequiredSignupConsent(user.id);
      setConsentRequired(!ok);
    } catch {
      setConsentRequired(true);
    } finally {
      setConsentReady(true);
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        rolesError,
        loading,
        consentReady,
        consentRequired,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshConsent,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

