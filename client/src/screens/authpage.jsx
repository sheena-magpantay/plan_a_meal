import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth, signIn, signUp, signInWithGoogle } from "../auth.jsx";

const EMPTY_FORM = { username: "", email: "", password: "", confirm: "" };

// Same rule as the profiles table in supabase/schema.sql.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

function validate(mode, form) {
  if (mode === "login") {
    if (!form.username.trim()) return "Enter your username or email.";
    if (!form.password) return "Enter your password.";
    return "";
  }
  if (!USERNAME_PATTERN.test(form.username)) {
    return "Username: 3 to 20 letters, numbers or underscores.";
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
  if (form.password.length < 6) return "Password: at least 6 characters.";
  if (form.password !== form.confirm) return "The passwords don't match.";
  return "";
}

// mode is "login" or "signup". Both screens share the wireframe's layout:
// logo, title, fields, one primary button, a link to the other screen, then
// "OR" and Continue with Google.
export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { session } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(""); // email a confirmation link went to

  // Signed in (just now, or already): go where they were headed.
  if (session) return <Navigate to={location.state?.from ?? "/"} replace />;

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    const problem = validate(mode, form);
    if (problem) return setError(problem);

    setBusy(true);
    setError("");
    try {
      if (isLogin) {
        await signIn(form.username, form.password);
      } else {
        const email = form.email.trim();
        const { needsConfirmation } = await signUp({
          username: form.username,
          email,
          password: form.password,
        });
        if (needsConfirmation) setSentTo(email);
      }
      // On success the session arrives through AuthProvider and the
      // <Navigate> above takes over.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(); // leaves the page for Google
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="authPage">
        <main className="authCard">
          <MailCheck className="authSentIcon" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="authTitle">Check your email</h1>
          <p className="authNote">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating
            your account, then log in.
          </p>
          <Link className="btn btn-primary authSubmit" to="/login">
            Back to log in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="authPage">
      <main className="authCard">
        <img src={logo} alt="Plan a Meal" className="authLogo" />
        <h1 className="authTitle">{isLogin ? "LOGIN" : "Create an account"}</h1>

        <form className="authForm" onSubmit={submit} noValidate>
          <input
            className="input"
            name="username"
            placeholder={isLogin ? "Username or email" : "Username"}
            aria-label={isLogin ? "Username or email" : "Username"}
            autoComplete="username"
            value={form.username}
            onChange={updateField}
          />
          {!isLogin && (
            <input
              className="input"
              name="email"
              type="email"
              placeholder="Email Address"
              aria-label="Email address"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
            />
          )}
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={form.password}
            onChange={updateField}
          />
          {!isLogin && (
            <input
              className="input"
              name="confirm"
              type="password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={updateField}
            />
          )}

          {error && (
            <p className="errorText" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary authSubmit" disabled={busy}>
            {isLogin ? (busy ? "Logging in…" : "Log in") : busy ? "Signing up…" : "Sign up"}
          </button>
        </form>

        <p className="authSwitch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Link to={isLogin ? "/signup" : "/login"} state={location.state}>
            {isLogin ? "Sign up" : "Log in"}
          </Link>
        </p>

        <p className="authDivider">
          <span>OR</span>
        </p>

        <button type="button" className="btn btn-outline authGoogle" onClick={google} disabled={busy}>
          <GoogleIcon />
          Continue with Google
        </button>
      </main>
    </div>
  );
}

// Google's "G" mark, in Google's own colours as their branding guide asks.
function GoogleIcon() {
  return (
    <svg className="googleIcon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
