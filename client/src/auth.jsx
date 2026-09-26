import { createContext, useContext, useEffect, useState } from "react";
import { supabase, SUPABASE_ENABLED } from "./supabase.js";

// Where Supabase sends people back to after Google sign-in or an email
// confirmation link. BASE_URL is "/" locally and "/<repo>/" on GitHub Pages.
// Both must be listed under Authentication > URL Configuration > Redirect URLs.
const redirectTo = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

const AuthContext = createContext({ session: null, user: null, loading: false });

// Holds the signed-in session for the whole app. session is undefined until
// Supabase has read it from storage (or from the URL after Google sign-in),
// so the app can wait instead of flashing the login page.
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

// Username from the sign up form, else the Google account's name, else the
// start of the email address.
export function displayName(user) {
  const meta = user?.user_metadata ?? {};
  return meta.username || meta.full_name || meta.name || user?.email?.split("@")[0] || "";
}

// Supabase's messages are written for developers; these are for people.
function friendly(error) {
  const message = error?.message ?? String(error);
  if (/invalid login credentials/i.test(message)) return new Error("Wrong username or password.");
  if (/email not confirmed/i.test(message)) {
    return new Error("Confirm your email first. Check your inbox for the link.");
  }
  if (/already registered/i.test(message)) {
    return new Error("An account with this email already exists. Log in instead.");
  }
  return new Error(message);
}

// The login form takes a username or an email. Supabase only knows emails,
// so a username is looked up first (supabase/schema.sql, email_for_username).
export async function signIn(identifier, password) {
  let email = identifier.trim();
  if (!email.includes("@")) {
    const { data, error } = await supabase.rpc("email_for_username", { name: email });
    if (error) throw friendly(error);
    if (!data) throw new Error("Wrong username or password.");
    email = data;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw friendly(error);
}

// Resolves to { needsConfirmation } : true when Supabase has emailed a
// confirmation link and there is no session yet.
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
  // With email confirmation on, Supabase does not say the email is taken (so
  // strangers cannot probe for accounts); it returns a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("An account with this email already exists. Log in instead.");
  }
  return { needsConfirmation: !data.session };
}

// Leaves the app for Google's sign-in page; Supabase brings the visitor back
// to redirectTo() with the session in the URL, which getSession() picks up.
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
