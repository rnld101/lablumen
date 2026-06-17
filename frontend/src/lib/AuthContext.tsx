import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { signIn as cognitoSignIn, signOutCognito } from "@/lib/cognito";
import {
  clearToken,
  getClaims,
  isStaff as claimsAreStaff,
  setToken,
  type Claims,
} from "@/lib/auth";

interface AuthContextValue {
  claims: Claims | null;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<Claims>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Claims | null>(() => getClaims());

  const login = async (email: string, password: string): Promise<Claims> => {
    const { idToken } = await cognitoSignIn(email, password);
    setToken(idToken);
    const next = getClaims();
    setClaims(next);
    if (!next) throw new Error("Login succeeded but the token could not be read.");
    return next;
  };

  const logout = () => {
    if (claims?.email) signOutCognito(claims.email);
    clearToken();
    setClaims(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ claims, isStaff: claimsAreStaff(claims), login, logout }),
    [claims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
