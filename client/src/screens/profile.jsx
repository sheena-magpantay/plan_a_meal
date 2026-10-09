import { useState } from "react";
import { Check, LogOut, Pencil, X } from "lucide-react";
import { useAuth, displayName, signOut, updateUsername } from "../auth.jsx";
import { SUPABASE_ENABLED } from "../supabase.js";

export default function Profile() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameNote, setNameNote] = useState("");

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
      await signOut(); 
    } catch (err) {
      setError(`Couldn't log out: ${err.message}`);
      setBusy(false);
    }
  }

  function startEditing() {
    setUsername(displayName(user));
    setNameError("");
    setNameNote("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setNameError("");
  }

  async function saveUsername(event) {
    event.preventDefault();
    setSaving(true);
    setNameError("");
    try {
      await updateUsername(username);
      setEditing(false);
      setNameNote("Username updated.");
    } catch (err) {
      setNameError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Profile</h1>
      <div className="card profileCard">
        <dl className="profileDetails">
          <dt className="text-label text-muted">Name</dt>
          <dd>
            {editing ? (
              <form className="usernameForm" onSubmit={saveUsername} noValidate>
                <input
                  className="input"
                  aria-label="Username"
                  autoComplete="username"
                  maxLength={20}
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => event.key === "Escape" && cancelEditing()}
                />
                <button
                  type="submit"
                  className="btn btn-primary iconBtn"
                  aria-label="Save username"
                  disabled={saving || !username.trim()}
                >
                  <Check size={16} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline iconBtn"
                  aria-label="Cancel"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </form>
            ) : (
              <span className="usernameRow">
                {displayName(user)}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={startEditing}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
              </span>
            )}
            {nameError && (
              <p className="errorText usernameMessage" role="alert">
                {nameError}
              </p>
            )}
            {nameNote && !editing && (
              <p className="text-muted usernameMessage" role="status">
                {nameNote}
              </p>
            )}
          </dd>
          <dt className="text-label text-muted">Email</dt>
          <dd>{user?.email}</dd>
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
