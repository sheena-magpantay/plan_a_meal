import { createContext, useContext, useEffect, useState } from "react";
import { supabase, SUPABASE_ENABLED } from "./supabase.js";

const redirectTo = () => `${window.location.origin}${import.meta.env.BASE_URL}`;
const AuthContext = createContext({ session: null, user: null, loading: false });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(SUPABASE_ENABLED ? undefined : null);
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = { session, user: session?.user ?? null, loading: session === undefined };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export function displayName(user) {
  const meta = user?.user_metadata ?? {};
  return meta.username || meta.full_name || meta.name || user?.email?.split("@")[0] || "";
}

function friendly(error) {
  const message = error?.message ?? String(error);
  if (/invalid login credentials/i.test(message)) return new Error("Wrong email or password.");
  if (/email not confirmed/i.test(message)) {
    return new Error("Confirm your email first. Check your inbox for the link.");
  }
  if (/already registered/i.test(message)) {
    return new Error("An account with this email already exists. Log in instead.");
  }
  return new Error(message);
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error);
}

export async function signUp({ username, email, password }) {
  const { data: available, error: lookupError } = await supabase.rpc("username_available", {
    name: username,
  });
  if (lookupError) throw friendly(lookupError);
  if (!available) throw new Error("That username is taken. Try another.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: redirectTo() },
  });
  if (error) throw friendly(error);
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("An account with this email already exists. Log in instead.");
  }
  return { needsConfirmation: !data.session };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo() },
  });
  if (error) throw friendly(error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw friendly(error);
}
