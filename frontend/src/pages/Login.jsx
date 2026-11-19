import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/auth";
import { socket } from "../services/socket";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await loginUser(form);

      // ✅ AUTH LOGIC (UNCHANGED)
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user", JSON.stringify(data.user)); // Store user object for Chatbot/etc

      if (!socket.connected) socket.connect();

      if (data.user.role === "student") navigate("/student");
      if (data.user.role === "staff") navigate("/staff");
      if (data.user.role === "admin") navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell min-h-screen">
      <button type="button" onClick={() => navigate("/")} className="auth-back" aria-label="Back to home">
        <ArrowLeft size={18} /> Back
      </button>
      <div className="auth-campus-panel" aria-hidden="true">
        <img src="/assets/kiet-campus.png" alt="" className="auth-campus-image" />
        <div className="auth-campus-overlay" />
        <div className="auth-campus-copy">
          <p>KIET University · Ghaziabad</p>
          <h1>Campus services, <span>without the wait.</span></h1>
        </div>
      </div>
      <div className="auth-form-panel">
        <form className="auth-card" onSubmit={(event) => { event.preventDefault(); handleLogin(); }} noValidate>
          <img src="/assets/kiet-university-logo.jpg" alt="KIET University" className="auth-logo" />
          <div className="auth-heading">
            <p>KIET Smart Queue</p>
            <h2>Welcome back</h2>
            <span>Sign in to continue</span>
          </div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <label className="auth-field">
            <span>Email address</span>
            <div className="auth-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input type="email" name="email" autoComplete="email" placeholder="you@campus.edu" value={form.email} onChange={handleChange} required />
            </div>
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={handleChange} required />
              <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <button type="submit" disabled={loading || !form.email || !form.password} className="btn-primary auth-submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="auth-footer">New to KIET Smart Queue? <button type="button" onClick={() => navigate("/signup")}>Create account</button></p>
        </form>
      </div>
    </main>
  );
}

