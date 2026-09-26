import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth, displayName, signOut } from "../auth.jsx";
import { SUPABASE_ENABLED } from "../supabase.js";

const providerNames = { email: "Email and password", google: "Google" };

export default function Profile() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!SUPABASE_ENABLED) {
    return (
      <section>
        <h1>Profile</h1>
        <p className="text-muted">
          Accounts are off. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env to
          turn on log in and save each person's week.
        </p>
      </section>
    );
  }

  async function logOut() {
    setBusy(true);
    setError("");
    try {
      await signOut(); // AuthProvider sees the session end and shows the login page
    } catch (err) {
      setError(`Couldn't log out: ${err.message}`);
      setBusy(false);
    }
  }

  const provider = user?.app_metadata?.provider ?? "email";

  return (
    <section>
      <h1>Profile</h1>
      <div className="card profileCard">
        <dl className="profileDetails">
          <dt className="text-label text-muted">Name</dt>
          <dd>{displayName(user)}</dd>
          <dt className="text-label text-muted">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-label text-muted">Signed in with</dt>
          <dd>{providerNames[provider] ?? provider}</dd>
        </dl>
        <p className="text-muted profileNote">
          Your weekly plan, shopping list ticks and ingredient edits are saved to this account.
        </p>
        {error && (
          <p className="errorText" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-outline" onClick={logOut} disabled={busy}>
          <LogOut size={16} aria-hidden="true" /> {busy ? "Logging out…" : "Log out"}
        </button>
      </div>
    </section>
  );
}
