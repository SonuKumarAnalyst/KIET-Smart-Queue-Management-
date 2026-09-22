import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { socket } from "../../services/socket";

export default function GuestTicket() {
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [servingTickets, setServingTickets] = useState([]);
  const [message, setMessage] = useState("");

  const [ticketCompleted, setTicketCompleted] = useState(false);
  const [showCompletedPopup, setShowCompletedPopup] = useState(false);

  // 🔔 NEW: ALERT PERMISSION STATE
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const joinedRef = useRef(false);

  /* ==========================
     SOCKET CONNECT LOG
  ========================== */
  useEffect(() => {
    socket.on("connect", () => {
      console.log("🟢 Guest socket connected:", socket.id);
    });

    return () => socket.off("connect");
  }, []);

  /* ==========================
     RESTORE TICKET
  ========================== */
  useEffect(() => {
    const restoreTicket = async () => {
      const guestToken = localStorage.getItem("guestToken");

      if (!guestToken) {
        navigate("/guest/join");
        return;
      }

      try {
        const res = await api.get("/guest/restore", {
          headers: { "x-guest-token": guestToken },
          withCredentials: true,
        });

        setTicket(res.data);
        
        // Initial fetch of serving tickets
        if (res.data.departmentId) {
          const servingRes = await api.get(`/queue/current-serving/${res.data.departmentId}`);
          setServingTickets(servingRes.data.servingTickets || []);
        }
      } catch {
        localStorage.removeItem("guestToken");
        navigate("/guest/join");
      } finally {
        setLoading(false);
      }
    };

    restoreTicket();
  }, [navigate]);

  /* ==========================
     LIVE SOCKET UPDATES
  ========================== */
  useEffect(() => {
    if (!ticket?.departmentId) return;

    if (!joinedRef.current) {
      socket.emit("join_department", ticket.departmentId);
      socket.emit("join_ticket", ticket.ticketId || ticket._id);
      joinedRef.current = true;
    }

    const onTicketTransferred = (data) => {
      setTicket(prev => ({ ...prev, departmentId: data.departmentId, department: data.toDepartmentName }));
      joinedRef.current = false;
      socket.emit("join_department", data.departmentId);
      refreshTicket();
      setMessage(`Ticket transferred to ${data.toDepartmentName}`);
    };

    const refreshTicket = async () => {
      const guestToken = localStorage.getItem("guestToken");
      if (!guestToken) return;
      try {
        const res = await api.get("/guest/restore", {
          headers: { "x-guest-token": guestToken },
          withCredentials: true,
        });
        setTicket(res.data);
      } catch (err) {
        console.error("Refresh ticket failed:", err);
      }
    };

    socket.on("ticket_called", (data) => {
      setServingTickets(prev => {
        const otherTickets = prev.filter(t => t.servedBy !== data.servedBy && t !== "EMERGENCY");
        return [...otherTickets, { ticketNumber: data.ticketNumber, servedBy: data.servedBy }];
      });

      if (data.ticketNumber === ticket.ticketNumber) {
        setIsMyTurn(true);
      }
      refreshTicket();
    });

    socket.on("ticket_completed", (data) => {
      setServingTickets(prev => prev.filter(t => t.ticketNumber !== data.ticketNumber));
      if (data.ticketNumber === ticket.ticketNumber) {
        setIsMyTurn(false);
        setTicketCompleted(true);
        setShowCompletedPopup(true);
      }
      refreshTicket();
    });

    socket.on("emergency_started", (data) => {
      setServingTickets([{ ticketNumber: "EMERGENCY", note: data.note }]);
      setMessage(data.note || "🚨 Emergency in progress. Please wait.");
    });

    socket.on("emergency_ended", () => {
      setServingTickets([]);
      setMessage("Emergency resolved. Queue resumed.");
      refreshTicket();
    });

    socket.on("emergency_your_turn", () => {
      setIsMyTurn(true);
      setServingTickets([{ ticketNumber: "EMERGENCY" }]);
    });

    socket.on("emergency_served", () => {
      setIsMyTurn(false);
      setTicketCompleted(true);
      setShowCompletedPopup(true);
    });

    socket.on("ticket_transferred", onTicketTransferred);

    return () => {
      socket.off("ticket_called");
      socket.off("ticket_completed");
      socket.off("emergency_started");
      socket.off("emergency_ended");
      socket.off("emergency_your_turn");
      socket.off("emergency_served");
      socket.off("ticket_transferred", onTicketTransferred);
    };
  }, [ticket]);

  /* ==========================
     🔔 VIBRATION ON MY TURN
  ========================== */
  useEffect(() => {
    if (isMyTurn && alertsEnabled && navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400]);
    }
  }, [isMyTurn, alertsEnabled]);

  /* ==========================
     ENABLE ALERTS (USER ACTION)
  ========================== */
  const enableAlerts = () => {
    if (navigator.vibrate) {
      navigator.vibrate(50); // test vibration
    }
    setAlertsEnabled(true);
  };

  /* ==========================
     CANCEL TICKET
  ========================== */
  const handleCancel = async () => {
    const guestToken = localStorage.getItem("guestToken");
    if (!guestToken) return;

    try {
      await api.post(
        "/guest/cancel",
        {},
        {
          headers: { "x-guest-token": guestToken },
          withCredentials: true,
        }
      );

      localStorage.removeItem("guestToken");
      socket.disconnect();
      navigate("/guest/join");
    } catch {
      setMessage("Failed to cancel ticket");
    }
  };

  /* ==========================
     AUTO DISMISS MESSAGE
  ========================== */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const estimatedTime =
    ticket?.position && ticket.position > 0
      ? ticket.position * 5
      : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300 bg-[#0b1220]">
        Loading your ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300 bg-[#0b1220]">
        No active ticket found.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex justify-center px-4 py-12 overflow-hidden text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1330] via-[#0f1f4d] to-[#141b3a]" />

      <div className="relative z-10 w-full max-w-md">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-100">
            Your Queue Ticket
          </h1>
          <p className="text-slate-400 mt-2">
            Please wait until your number is called
          </p>
        </div>

        {/* 🔔 ENABLE ALERTS BUTTON */}
        {!alertsEnabled && (
          <button
            onClick={enableAlerts}
            className="mb-8 w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg hover:bg-indigo-700 transition"
          >
            🔔 Enable Turn Alerts
          </button>
        )}

        {/* NOW SERVING */}
        <div className="text-center mb-12">
          <p className="uppercase tracking-widest text-sm text-slate-400 mb-6">
            Now Serving
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {servingTickets.length > 0 ? servingTickets.map((t, idx) => (
              <div key={idx} className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 min-w-[120px] backdrop-blur-md">
                <div className="text-4xl font-extrabold text-blue-500">
                  {t.ticketNumber}
                </div>
                {t.servedBy && <p className="text-[10px] text-slate-400 mt-2">Counter: {t.servedBy.fullName || "Staff"}</p>}
              </div>
            )) : (
              <div className="text-7xl font-extrabold text-blue-500 opacity-20">
                --
              </div>
            )}
          </div>

          {isMyTurn && (
            <div className="mt-8 px-6 py-3 rounded-full bg-emerald-600 text-white font-semibold text-lg animate-pulse">
              🔔 It’s your turn! Please proceed
            </div>
          )}
        </div>

        {/* TICKET CARD */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8">
          <p className="text-center mb-4">
            Ticket Number: <b>{ticket.ticketNumber}</b>
          </p>
          <p className="text-center">
            Estimated wait: <b>{estimatedTime || "--"} mins</b>
          </p>

          {!ticketCompleted && (
            <button
              onClick={handleCancel}
              disabled={isMyTurn}
              className="mt-8 w-full py-3 rounded-xl bg-red-500 text-white font-semibold disabled:opacity-50"
            >
              Cancel Ticket
            </button>
          )}
        </div>
      </div>

      {/* COMPLETED POPUP */}
      {showCompletedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0b1220] rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-emerald-400 mb-4">
              ✅ Ticket Completed
            </h2>
            <button
              onClick={() => {
                localStorage.removeItem("guestToken");
                socket.disconnect();
                navigate("/guest/join");
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold"
            >
              Join Another Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
