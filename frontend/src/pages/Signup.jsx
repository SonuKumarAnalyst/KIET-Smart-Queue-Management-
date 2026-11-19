import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import { signupUser } from "../services/auth";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      setError("");
      await signupUser(form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
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
          <h1>One queue. <span>Every service.</span></h1>
        </div>
      </div>
      <div className="auth-form-panel">
        <form className="auth-card auth-card-signup" onSubmit={(event) => { event.preventDefault(); handleSignup(); }} noValidate>
          <img src="/assets/kiet-university-logo.jpg" alt="KIET University" className="auth-logo" />
          <div className="auth-heading">
            <p>KIET Smart Queue</p>
            <h2>Create account</h2>
            <span>Join the campus network</span>
          </div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <label className="auth-field">
            <span>Full name</span>
            <div className="auth-input-wrap">
              <User size={18} aria-hidden="true" />
              <input name="fullName" autoComplete="name" placeholder="Enter full name" value={form.fullName} onChange={handleChange} required />
            </div>
          </label>
          <label className="auth-field">
            <span>Email address</span>
            <div className="auth-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input name="email" type="email" autoComplete="email" placeholder="you@campus.edu" value={form.email} onChange={handleChange} required />
            </div>
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Minimum 6 characters" value={form.password} onChange={handleChange} minLength={6} required />
              <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="auth-field">
            <span>Account role</span>
            <select name="role" value={form.role} onChange={handleChange} required>
              <option value="" disabled>Select role</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <button type="submit" disabled={loading || !form.fullName || !form.email || form.password.length < 6 || !form.role} className="btn-primary auth-submit">
            {loading ? "Creating account..." : "Create account"}
          </button>
          <p className="auth-footer">Already registered? <button type="button" onClick={() => navigate("/login")}>Sign in</button></p>
        </form>
      </div>
    </main>
  );
}
