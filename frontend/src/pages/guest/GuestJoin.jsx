import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function GuestJoin() {
  /* ==========================
     DEBUG – CONFIRM FILE LOAD
  ========================== */
  console.log("🔥 GUEST JOIN FILE LOADED 🔥");

  /* ==========================
     ROUTER HOOKS
  ========================== */
  const { sessionToken } = useParams();
  const navigate = useNavigate();

  /* ==========================
     FORM STATE
  ========================== */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  /* ==========================
     ENSURE GUEST IS ANONYMOUS
  ========================== */
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
  }, []);

  /* ==========================
     SESSION TOKEN GUARD
  ========================== */
  useEffect(() => {
    if (!sessionToken) {
      setMessage("Invalid or expired session");
    }
  }, [sessionToken]);

  /* ==========================
     JOIN QUEUE (SESSION BASED)
  ========================== */
  const handleJoin = async () => {
    if (!sessionToken) return;
    await executeJoin();
  };

  const executeJoin = async () => {
    try {
      setLoading(true);
      setMessage("");

      const guestToken = localStorage.getItem("guestToken");

      const res = await api.post(
        `/guest/join/${sessionToken}`,
        { name, phone },
        {
          headers: guestToken ? { "x-guest-token": guestToken } : {},
          withCredentials: true,
        }
      );

      // Store guest token for restore/cancel
      if (res.data.guestToken) {
        localStorage.setItem("guestToken", res.data.guestToken);
      }

      toast.success("your queue ticket is created");
      navigate("/guest/ticket");
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Failed to join queue. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================
     AUTO DISMISS MESSAGE
  ========================== */
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);

  /* ==========================
     UI
  ========================== */
  return (
    <main className="auth-shell min-h-screen">
      <div className="auth-campus-panel" aria-hidden="true">
        <img src="/assets/kiet-campus.png" alt="" className="auth-campus-image" />
        <div className="auth-campus-overlay" />
        <div className="auth-campus-copy">
          <p>KIET University · Guest access</p>
          <h1>Join the line. <span>Keep your place.</span></h1>
        </div>
      </div>
      <div className="auth-form-panel">
        <form className="auth-card" onSubmit={(event) => { event.preventDefault(); handleJoin(); }}>
          <img src="/assets/kiet-university-logo.jpg" alt="KIET University" className="auth-logo" />
          <div className="auth-heading">
            <p>Guest queue</p>
            <h2>Join the queue</h2>
            <span>Enter optional details to receive a ticket</span>
          </div>
          {message && <div className="auth-error" role="alert">{message}</div>}
          <label className="auth-field">
            <span>Name <small>(optional)</small></span>
            <input placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Phone <small>(optional)</small></span>
            <input type="tel" inputMode="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button type="submit" disabled={loading || !sessionToken} className="btn-primary auth-submit">
            {loading ? "Joining..." : "Join queue"}
          </button>
          <p className="auth-footer">Your ticket and live position appear after joining.</p>
        </form>
      </div>
    </main>
  );
}
