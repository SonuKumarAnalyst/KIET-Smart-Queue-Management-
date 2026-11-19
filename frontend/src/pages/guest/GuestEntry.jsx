import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function GuestEntry() {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const enterViaQr = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/guest/entry/${qrId}`,
          { withCredentials: true }
        );

        const redirectUrl = res.data.redirectUrl;
        const hashPath = redirectUrl.split("#")[1];
        navigate(hashPath, { replace: true });

      } catch (err) {
        setError(err.response?.data?.message || "QR expired or invalid");
        window.setTimeout(() => navigate("/", { replace: true }), 2500);
      }
    };

    enterViaQr();
  }, [qrId, navigate]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 text-[var(--text-secondary)]" role="status" aria-live="polite">
      {error ? (
        <div className="auth-error max-w-md text-center">{error}</div>
      ) : (
        <p className="animate-pulse text-lg">Processing QR… Please wait</p>
      )}
    </main>
  );
}
