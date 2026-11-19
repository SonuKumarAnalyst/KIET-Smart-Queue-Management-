import { useEffect, useState } from "react";
import { PhoneOff, Video, X } from "lucide-react";
import { socket } from "../services/socket";
import { acceptVideoCall, rejectVideoCall, endVideoCall } from "../services/calls";
import toast from "react-hot-toast";

export default function VideoCallModal() {
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    const onIncomingCall = (call) => {
      setIncoming(call);
      setActiveCall(null);
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    };
    const onCallAccepted = (call) => {
      setIncoming(null);
      setActiveCall(call);
    };
    const onCallRejected = () => {
      setIncoming(null);
      setActiveCall(null);
      toast.error("The student declined the video call.");
    };
    const onCallEnded = () => {
      setIncoming(null);
      setActiveCall(null);
      toast.success("Video call ended.");
    };
    const onOpenCall = (event) => {
      setIncoming(null);
      setActiveCall(event.detail);
    };

    socket.on("incoming_call", onIncomingCall);
    socket.on("call_accepted", onCallAccepted);
    socket.on("call_rejected", onCallRejected);
    socket.on("call_ended", onCallEnded);
    window.addEventListener("open-video-call", onOpenCall);

    return () => {
      socket.off("incoming_call", onIncomingCall);
      socket.off("call_accepted", onCallAccepted);
      socket.off("call_rejected", onCallRejected);
      socket.off("call_ended", onCallEnded);
      window.removeEventListener("open-video-call", onOpenCall);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape" || !incoming) return;
      rejectVideoCall(incoming.callId).finally(() => setIncoming(null));
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [incoming]);

  const handleAccept = async () => {
    try {
      const call = await acceptVideoCall(incoming.callId);
      setIncoming(null);
      setActiveCall(call);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not join the call.");
    }
  };

  const handleReject = async () => {
    try {
      await rejectVideoCall(incoming.callId);
    } catch {
      // The call is still removed locally even if the request fails.
    } finally {
      setIncoming(null);
    }
  };

  const handleEnd = async () => {
    if (!activeCall?.callId) return;
    try {
      await endVideoCall(activeCall.callId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not end the call.");
    } finally {
      setActiveCall(null);
    }
  };

  if (!incoming && !activeCall) return null;

  if (incoming) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="incoming-call-title">
        <div className="w-full max-w-sm rounded-3xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
            <Video size={30} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--accent-primary)]">Incoming video call</p>
          <h2 id="incoming-call-title" className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{incoming.staffName}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Ticket {incoming.ticketNumber}
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleReject}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-bold text-red-500"
            >
              <X size={18} /> Decline
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="btn-primary flex items-center justify-center gap-2 px-4 py-3"
            >
              <Video size={18} /> Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  const domain = activeCall.domain || "meet.jit.si";
  const roomName = encodeURIComponent(activeCall.roomName);
  const src = `https://${domain}/${roomName}?config.prejoinPageEnabled=true&config.disableDeepLinking=true`;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-slate-950">
      <iframe
        title="Secure video call"
        src={src}
        allow="camera; microphone; fullscreen; display-capture"
        className="h-full w-full border-0"
      />
      <button
        type="button"
        onClick={handleEnd}
        className="fixed bottom-5 left-1/2 z-[301] flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-bold text-white shadow-2xl"
        aria-label="End video call"
      >
        <PhoneOff size={20} /> End Call
      </button>
    </div>
  );
}
