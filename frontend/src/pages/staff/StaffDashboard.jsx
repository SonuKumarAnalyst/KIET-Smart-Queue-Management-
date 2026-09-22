import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getStaffProfile,
  callNextTicket,
  completeTicket,
  togglePauseQueue,
  increaseQueueLimit,
  getQueueStats,
  getPendingEmergencies,
  markNoShow,
  sendBroadcast,
} from "../../services/staff";
import api from "../../services/api";
import { socket } from "../../services/socket";
import DashboardSidebar from "../../components/DashboardSidebar";
import { getDepartmentSupportRequests, updateSupportRequest } from "../../services/support";
import { Activity, Settings, QrCode, Megaphone, User, Users, LayoutDashboard, Calendar, Clock, CheckCircle, XCircle, AlertTriangle, RotateCcw, Info, Flame, ArrowRight, HelpCircle } from "lucide-react";

export default function StaffDashboard({ initialTab = "overview" }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const [staff, setStaff] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [increaseBy, setIncreaseBy] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencies, setEmergencies] = useState([]);
  const [allEmergencies, setAllEmergencies] = useState([]);
  const [pendingEmergencies, setPendingEmergencies] = useState(0);

  const [stats, setStats] = useState({ total: 0, served: 0, waiting: 0, serving: 0, onHold: 0 });
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [note, setNote] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [targetPos, setTargetPos] = useState(""); // "" = End, "1" = 1st, "2" = 2nd
  const [activeTicketData, setActiveTicketData] = useState(null);
   const [arrivalTimeLeft, setArrivalTimeLeft] = useState(0);
  const activeTicketRef = useRef(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
   const [supportRequests, setSupportRequests] = useState([]);
   const [supportReply, setSupportReply] = useState({});
  const joinedRef = useRef(false);

  useEffect(() => {
    activeTicketRef.current = activeTicketData;
  }, [activeTicketData]);

   useEffect(() => {
      if (!activeTicketData?.calledAt || activeTicketData.status !== "serving") {
         setArrivalTimeLeft(0);
         return;
      }

      const updateArrivalTime = () => {
         const elapsed = Math.floor((Date.now() - new Date(activeTicketData.calledAt).getTime()) / 1000);
         setArrivalTimeLeft(Math.max(0, 300 - elapsed));
      };

      updateArrivalTime();
      const timer = setInterval(updateArrivalTime, 1000);
      return () => clearInterval(timer);
   }, [activeTicketData?.calledAt, activeTicketData?.status]);

  const fetchActiveTicketDetails = useCallback(async (ticketId) => {
     try {
        const res = await api.get(`/staff/ticket/${ticketId}`);
        setActiveTicketData(res.data);
     } catch (err) {
        console.error("Fetch ticket details failed:", err);
     }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await getStaffProfile();
      setStaff(data);
      if (data.currentTicketDetails) {
         setCurrentTicket(data.currentTicketDetails.ticketNumber);
         fetchActiveTicketDetails(data.currentTicketDetails._id);
      }
      if (!joinedRef.current && data?.department?._id) {
        socket.emit("join_department", data.department._id);
        joinedRef.current = true;
      }
      
      // Request notifications for emergency alerts
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {
      setMessage("Failed to load staff");
    }
  }, [fetchActiveTicketDetails]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getQueueStats();
      setStats(data);
    } catch (err) {
      console.error("Fetch stats failed:", err);
    }
  }, []);

  const fetchEmergencyCount = useCallback(async () => {
    try {
      const res = await api.get("/staff/emergency/count");
      setPendingEmergencies(res.data.count);
    } catch (err) {
      console.error("Fetch emergency count failed:", err);
    }
  }, []);

  const fetchEmergencies = useCallback(async () => {
    try {
      const data = await getPendingEmergencies();
      setEmergencies(data);
      const historyRes = await api.get("/staff/emergency/history");
      setAllEmergencies(historyRes.data);
    } catch (err) {
      console.error("Fetch emergencies failed:", err);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get("/staff/transfer-departments");
      setDepartments(res.data);
    } catch (err) {
      console.error("Fetch departments failed:", err);
    }
  }, []);

  const fetchDepartmentTickets = useCallback(async () => {
    try {
      const res = await api.get("/staff/department-tickets");
      setAllTickets(res.data);
    } catch (err) {
      console.error("Fetch department tickets failed:", err);
    }
  }, []);

   const fetchSupportRequests = useCallback(async () => {
      try {
         setSupportRequests(await getDepartmentSupportRequests());
      } catch (err) {
         console.error("Fetch support requests failed:", err);
      }
   }, []);
  
  const fetchAppointments = useCallback(async () => {
    try {
      const res = await api.get("/appointments/department", {
        params: { date: selectedDate }
      });
      setAppointments(res.data);
    } catch (err) {
      console.error("Fetch appointments failed:", err);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchStaff();
    fetchStats();
    fetchEmergencyCount();
    fetchEmergencies();
    fetchDepartments();
    fetchAppointments();
    fetchDepartmentTickets();
   fetchSupportRequests();

    const onEmergencyRequested = (data) => {
      fetchEmergencyCount();
      fetchEmergencies();
      
      // Staff Notification
      if (Notification.permission === "granted") {
        new Notification("🚨 NEW EMERGENCY REQUEST", {
          body: `Reason: ${data?.reason || "No reason provided"}`,
        });
      }
    };

    socket.on("emergency_requested", onEmergencyRequested);
    return () => socket.off("emergency_requested", onEmergencyRequested);
   }, [fetchStaff, fetchStats, fetchEmergencyCount, fetchEmergencies, fetchDepartments, fetchAppointments, fetchDepartmentTickets, fetchSupportRequests]);

   const handleSupportUpdate = async (requestId, status) => {
      try {
         await updateSupportRequest(requestId, { status, staffResponse: supportReply[requestId] || "" });
         setSupportReply((current) => ({ ...current, [requestId]: "" }));
         await fetchSupportRequests();
         setMessage("Student support request updated.");
      } catch (err) {
         setMessage(err.response?.data?.message || "Failed to update support request");
      }
   };

  const handleAddNote = async () => {
    if (!note || !activeTicketData) return;
    try {
      const res = await api.post("/staff/add-note", {
        ticketId: activeTicketData._id,
        content: note,
      });
      setNote("");
      // 🔥 Update UI immediately with populated data
      if (res.data.ticket) {
        setActiveTicketData(res.data.ticket);
      } else {
        fetchActiveTicketDetails(activeTicketData._id);
      }
    } catch {
      setMessage("Failed to add note");
    }
  };

  const handleTransfer = async () => {
    if (!selectedDept || !activeTicketData) return;
    try {
      await api.post("/staff/transfer", {
        ticketId: activeTicketData._id,
        toDepartmentId: selectedDept,
        internalNote: transferNote,
        targetPosition: targetPos ? parseInt(targetPos) : null
      });
      setMessage(`Ticket ${activeTicketData.ticketNumber} transferred.`);
      setCurrentTicket(null);
      setActiveTicketData(null);
      setSelectedDept("");
      setTransferNote("");
      setTargetPos("");
      fetchStats();
    } catch {
      setMessage("Transfer failed");
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, fetchAppointments]);

  /* SOCKETS */
  useEffect(() => {
    const onTicketCalled = async (data) => {
      // 🔥 Only update current ticket state if THIS staff member called it
      if (data.servedBy === staff?._id) {
        setCurrentTicket(data.ticketNumber);
        if (data.ticketId) fetchActiveTicketDetails(data.ticketId);
      }
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data.ticketNumber} called`);
    };
    const onTicketCompleted = (data) => {
      // 🔥 Only clear state if THIS staff member completed it
      if (data.servedBy === staff?._id) {
        setCurrentTicket(null);
        setActiveTicketData(null);
        setCompleting(false);
      }
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data?.ticketNumber || "Active"} completed`);
    };
    
    const onTicketNoShow = (data) => {
      if (data.ticketId === activeTicketRef.current?._id) {
        setCurrentTicket(null);
        setActiveTicketData(null);
      }
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data.ticketNumber} marked as no-show`);
    };

    const onTicketCancelled = (data) => {
      if (data.ticketNumber === activeTicketRef.current?.ticketNumber) {
        setCurrentTicket(null);
        setActiveTicketData(null);
      }
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data.ticketNumber} left the queue`);
    };

    const onTicketTransferredOut = (data) => {
      if (data.ticketId === activeTicketRef.current?._id) {
        setCurrentTicket(null);
        setActiveTicketData(null);
      }
      fetchStats();
      fetchDepartmentTickets();
    };

    const onTicketTransferredIn = (data) => {
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data.ticketNumber} transferred to your department`);
    };

    const onEmergencyStarted = (data) => {
      setEmergencyActive(true);
      setCurrentTicket("EMERGENCY");
      fetchDepartmentTickets();
      addActivity(`🚨 Emergency started: ${data?.note || "Priority service active"}`);
    };
    const onEmergencyEnded = () => {
      setEmergencyActive(false);
      setCurrentTicket(null);
      fetchDepartmentTickets();
      addActivity("✅ Emergency resolved");
    };

    const onPauseToggled = (data) => {
      setIsPaused(data.isPaused);
      addActivity(`Queue ${data.isPaused ? "Paused" : "Resumed"}`);
    };

    const onHoldToggled = (data) => {
      fetchStats();
      fetchDepartmentTickets();
      addActivity(`Ticket ${data.ticketNumber} ${data.status === 'hold' ? 'stepped away' : 'returned'}`);
    };

    const onTicketJoined = (data) => {
      fetchStats();
      fetchDepartmentTickets();
      fetchAppointments(); // Refresh appointments list to show check-in status
      addActivity(`Ticket ${data.ticketNumber} joined the queue`);
    };

    const addActivity = (msg) => {
      setActivityFeed(prev => [{
        id: Date.now(),
        message: msg,
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 10));
    };

    socket.on("ticket_called", onTicketCalled);
    socket.on("ticket_completed", onTicketCompleted);
    socket.on("ticket_no_show", onTicketNoShow);
    socket.on("ticket_cancelled", onTicketCancelled);
    socket.on("ticket_transferred_out", onTicketTransferredOut);
    socket.on("ticket_transferred_in", onTicketTransferredIn);
    socket.on("emergency_started", onEmergencyStarted);
    socket.on("emergency_ended", onEmergencyEnded);
    socket.on("queue_pause_toggled", onPauseToggled);
    socket.on("ticket_hold_toggled", onHoldToggled);
    socket.on("ticket_joined", onTicketJoined);

    return () => {
      socket.off("ticket_called", onTicketCalled);
      socket.off("ticket_completed", onTicketCompleted);
      socket.off("ticket_no_show", onTicketNoShow);
      socket.off("ticket_cancelled", onTicketCancelled);
      socket.off("ticket_transferred_out", onTicketTransferredOut);
      socket.off("emergency_started", onEmergencyStarted);
      socket.off("emergency_ended", onEmergencyEnded);
      socket.off("queue_pause_toggled", onPauseToggled);
      socket.off("ticket_hold_toggled", onHoldToggled);
      socket.off("ticket_joined", onTicketJoined);
    };
  }, [staff?._id, fetchStats, fetchActiveTicketDetails, fetchAppointments, fetchDepartmentTickets]);

  /* ACTIONS */
  const handleCallNext = async () => {
    try {
      const data = await callNextTicket();
      setCurrentTicket(data.ticketNumber);
      if (data.ticketId) fetchActiveTicketDetails(data.ticketId);
      setMessage(data.message);
      fetchStats();
    } catch (err) {
      setMessage(err.response?.data?.message || "No tickets in queue");
    }
  };

  const handleCompleteTicket = async () => {
    if (completing) return;
    try {
      setCompleting(true);
      const data = await completeTicket();
      setMessage(data.message);
      fetchStats();
    } catch (err) {
      setMessage(err.response?.data?.message || "No active ticket");
      setCompleting(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      const data = await togglePauseQueue();
      setIsPaused(data.isPaused);
      setMessage(data.message);
    } catch {
      setMessage("Failed to toggle pause");
    }
  };

  const handleIncreaseLimit = async () => {
    if (!increaseBy || Number(increaseBy) <= 0) return;
    try {
      const data = await increaseQueueLimit(Number(increaseBy));
      setMessage(`Queue limit updated to ${data.maxTickets}`);
      setIncreaseBy("");
    } catch {
      setMessage("Failed to update limit");
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await sendBroadcast(broadcastMsg);
      setMessage("Broadcast sent to all students!");
      setBroadcastMsg("");
    } catch {
      setMessage("Failed to send broadcast");
    }
  };

  const handleGenerateQR = async () => {
    try {
      setQrLoading(true);
      const res = await api.get("/staff/department/qr");
      setQrData(res.data);
      setMessage("");
    } catch {
      setMessage("Failed to generate QR");
    } finally {
      setQrLoading(false);
    }
  };

  const handleStartEmergency = async (id = null) => {
    try {
      const payload = { note: "Emergency in progress" };
      if (id) payload.emergencyId = id; // Update backend to handle specific ID if desired, otherwise it still picks first approved
      await api.post("/staff/emergency/start", payload);
      fetchEmergencyCount();
      fetchEmergencies();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to start emergency");
    }
  };

  const handleEndEmergency = async () => {
    try {
      await api.post("/staff/emergency/end");
    } catch {
      setMessage("Failed to resolve emergency");
    }
  };

  const handleRejectEmergency = async (id) => {
    try {
      await api.post(`/staff/emergency/reject/${id}`);
      setMessage("Emergency rejected");
      fetchEmergencyCount();
      fetchEmergencies();
    } catch {
      setMessage("Failed to reject emergency");
    }
  };

  const handleApproveEmergency = async (id) => {
    try {
      await api.post(`/staff/emergency/approve/${id}`);
      setMessage("Emergency approved");
      fetchEmergencyCount();
      fetchEmergencies();
    } catch {
      setMessage("Failed to approve emergency");
    }
  };

  const handleMarkNoShow = async () => {
    if (!activeTicketData) return;
    try {
      await markNoShow(activeTicketData._id);
      setMessage(`Ticket ${activeTicketData.ticketNumber} marked as no-show.`);
      setCurrentTicket(null);
      setActiveTicketData(null);
      fetchStats();
    } catch {
      setMessage("Failed to mark no-show");
    }
  };

  const tabs = [
    { id: "overview", label: "Queue Visuals", icon: Activity },
   { id: "helpdesk", label: "Student Helpdesk", icon: HelpCircle },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "history", label: "Emergency History", icon: RotateCcw },
    { id: "settings", label: "Queue Settings", icon: Settings },
    { id: "qr", label: "QR Generator", icon: QrCode },
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <DashboardSidebar 
        title="Staff Panel" 
        tabs={tabs} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 transition-all duration-300 relative">
        
        {/* HEADER */}
        <header className="mb-10">
           <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              {activeTab === "overview" && "Live Operations"}
              {activeTab === "helpdesk" && "Student Helpdesk"}
              {activeTab === "appointments" && "Daily Schedule"}
              {activeTab === "settings" && "Queue Control"}
              {activeTab === "qr" && "Access Code"}
           </h1>
           <p className="text-[var(--text-secondary)] mt-1">
              Department: <span className="font-semibold text-[var(--accent-primary)]">{staff?.department?.name || "Loading..."}</span>
           </p>
        </header>

        <AnimatePresence mode="wait">
           <motion.div
             key={activeTab}
             initial={{ opacity: 0, x: 10 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -10 }}
             transition={{ duration: 0.2, ease: "easeOut" }}
           >
              {/* TAB 1: OVERVIEW & OPERATIONS */}
              {activeTab === "overview" && (
           <div className="animate-fade-in space-y-12">
              
              {/* 🚨 EMERGENCY REQUESTS (TOP PRIORITY) */}
              {pendingEmergencies > 0 && (
                 <div className="bg-red-500/10 border-2 border-red-500/30 rounded-3xl p-6 shadow-2xl shadow-red-500/10 animate-pulse">
                    <h3 className="text-red-500 font-black mb-6 flex items-center gap-3 text-xl uppercase tracking-tighter">
                      <AlertTriangle className="animate-bounce" /> {pendingEmergencies} ACTION REQUIRED: EMERGENCY REQUESTS
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                       {emergencies.map((e) => (
                         <div key={e._id} className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-red-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex-1">
                               <div className="flex items-center gap-3 mb-2">
                                  <p className="font-black text-lg text-white">{e.student?.name}</p>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-yellow-500 text-black">
                                    {e.status}
                                  </span>
                               </div>
                               <p className="text-sm text-red-200/70 font-medium">Reason: {e.reason}</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                              {e.proof && (
                                <a 
                                  href={`${import.meta.env.VITE_API_URL.replace("/api", "")}${e.proof}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-2 border border-white/10"
                                >
                                  📄 View Proof
                                </a>
                              )}
                              {e.status === "pending" ? (
                                 <>
                                    <button 
                                      onClick={() => handleApproveEmergency(e._id)} 
                                      className="flex-1 md:flex-none px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all active:scale-95"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleRejectEmergency(e._id)} 
                                      className="flex-1 md:flex-none px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-black hover:bg-slate-700 border border-white/5 transition-all active:scale-95"
                                    >
                                      Reject
                                    </button>
                                 </>
                              ) : e.status === "approved" && !emergencyActive && (
                                 <button 
                                   onClick={() => handleStartEmergency(e._id)} 
                                   className="w-full md:w-auto px-8 py-2 bg-red-600 text-white rounded-xl text-sm font-black animate-pulse shadow-lg shadow-red-600/20"
                                 >
                                    🚀 Start Priority Service
                                  </button>
                              )}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              )}

              {/* LIVE OPERATION HERO */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* NOW SERVING CARD */}
                 <div className="lg:col-span-2 nebula-card p-12 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                    <div className="absolute top-8 left-10 flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Live Operation</span>
                    </div>
                    
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={currentTicket || "idle"}
                        initial={{ opacity: 0, y: 40, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -40, scale: 1.1, filter: "blur(20px)" }}
                        transition={{ type: "spring", damping: 20, stiffness: 100 }}
                        className="relative z-10 text-center"
                      >
                         <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-8">Currently Serving</p>
                         <div className="relative inline-block">
                            <h2 className="text-[120px] md:text-[180px] font-black leading-none text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] tracking-tighter">
                               {currentTicket || <span className="text-slate-800 opacity-20 italic">IDLE</span>}
                            </h2>
                            <div className="absolute -inset-10 bg-blue-500/5 blur-[80px] -z-10 rounded-full" />
                         </div>
                         {emergencyActive && (
                            <motion.div 
                               initial={{ opacity: 0, scale: 0.5 }}
                               animate={{ opacity: 1, scale: 1 }}
                               className="mt-10 inline-flex items-center gap-3 bg-red-500/20 text-red-400 px-8 py-2 rounded-full border border-red-500/30 animate-pulse"
                            >
                               <Flame size={20} />
                               <span className="font-black uppercase tracking-widest text-sm">Emergency Mode Active</span>
                            </motion.div>
                         )}
                      </motion.div>
                    </AnimatePresence>
                 </div>

                 {/* STATS MINI-PANEL */}
                 <div className="grid grid-cols-1 gap-6">
                    <div className="nebula-card p-8 flex flex-col justify-center border-blue-500/10 hover:border-blue-500/30">
                       <div className="flex justify-between items-center mb-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Remaining in Queue</p>
                          <User size={18} className="text-blue-400" />
                       </div>
                       <h4 className="text-6xl font-black text-white mb-2">{stats.waiting}</h4>
                       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${Math.min(100, (stats.waiting / (stats.total || 1)) * 100)}%` }}
                             className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                          />
                       </div>
                    </div>
                    
                    <div className="nebula-card p-8 flex flex-col justify-center border-purple-500/10 hover:border-purple-500/30">
                       <div className="flex justify-between items-center mb-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg. Service Time</p>
                          <Clock size={18} className="text-purple-400" />
                       </div>
                       <h4 className="text-6xl font-black text-white mb-2">12<span className="text-2xl ml-1 opacity-40">m</span></h4>
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Per student today</p>
                    </div>

                    <div className="nebula-card p-8 flex flex-col justify-center border-green-500/10 hover:border-green-500/30">
                       <div className="flex justify-between items-center mb-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Completed Today</p>
                          <CheckCircle size={18} className="text-green-400" />
                       </div>
                       <h4 className="text-6xl font-black text-white mb-2">{stats.served}</h4>
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Success rate: 98%</p>
                    </div>
                 </div>
              </div>

              {/* ACTION COMMAND CENTER */}
              <div className="nebula-card p-10 bg-white/5 border-white/5 flex flex-wrap justify-center gap-8">
                 <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(37, 99, 235, 0.3)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCallNext}
                    disabled={stats.waiting === 0 || emergencyActive}
                    className="btn-primary px-16 py-6 text-xl rounded-[2rem] w-full md:w-auto shadow-2xl disabled:opacity-40"
                 >
                    <div className="flex items-center gap-3">
                       Call Next <ArrowRight size={24} />
                    </div>
                 </motion.button>
                 
                 {emergencyActive ? (
                    <motion.button
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={handleEndEmergency}
                       className="bg-green-600 text-white px-16 py-6 text-xl rounded-[2rem] w-full md:w-auto hover:bg-green-700 font-black shadow-2xl shadow-green-600/30 flex items-center gap-3"
                    >
                       <CheckCircle size={24} /> Resolve Emergency
                    </motion.button>
                 ) : (
                    <motion.button
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={handleCompleteTicket}
                       disabled={!currentTicket || completing}
                       className="nebula-card bg-white/5 border-white/10 px-16 py-6 text-xl rounded-[2rem] w-full md:w-auto hover:bg-white/10 text-white font-black transition-all flex items-center gap-3"
                    >
                       {completing ? "Completing..." : "End Session"} <RotateCcw size={24} className={completing ? "animate-spin" : ""} />
                    </motion.button>
                 )}

                 <div className="flex gap-4 w-full md:w-auto">
                    {activeTicketData && (
                       <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleMarkNoShow}
                          disabled={arrivalTimeLeft > 0}
                          title={arrivalTimeLeft > 0 ? "Wait for the arrival window to expire" : "Mark ticket as no-show"}
                          className="flex-1 md:flex-none px-10 py-6 text-sm rounded-[2rem] border border-red-500/20 text-red-500 hover:bg-red-500/10 font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                       >
                          No-Show
                       </motion.button>
                    )}
                    
                    <motion.button
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={handleTogglePause}
                       className={`flex-1 md:flex-none px-10 py-6 text-sm rounded-[2rem] border font-black uppercase tracking-widest transition-all ${
                          isPaused 
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-500" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                       }`}
                    >
                       {isPaused ? "Resume Queue" : "Pause Queue"}
                    </motion.button>
                 </div>
              </div>

              {/* TICKET CONTEXT (NOTES & TRANSFER) */}
              {activeTicketData && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                   <div className={`card p-6 border ${arrivalTimeLeft > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div>
                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Arrival Window</p>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Allow the student this time to reach the counter before marking no-show.</p>
                         </div>
                         <p className={`text-3xl font-mono font-black ${arrivalTimeLeft > 0 ? "text-amber-400" : "text-red-400"}`}>
                            {arrivalTimeLeft > 0 ? `${Math.floor(arrivalTimeLeft / 60)}:${String(arrivalTimeLeft % 60).padStart(2, "0")}` : "Expired"}
                         </p>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* NOTES SECTION */}
                   <div className="card p-6 flex flex-col h-full border-blue-500/10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                        📝 Internal Notes
                      </h3>
                      <div className="flex-1 overflow-y-auto max-h-[200px] mb-4 space-y-3 pr-2 scrollbar-thin">
                         {activeTicketData.notes?.length > 0 ? activeTicketData.notes.map((n, i) => (
                           <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <p className="text-sm text-[var(--text-primary)]">{n.content}</p>
                              <div className="flex justify-between mt-2 opacity-50 text-[10px]">
                                 <span>By {n.author?.fullName || "Staff"}</span>
                                 <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                              </div>
                           </div>
                         )) : (
                           <p className="text-xs text-[var(--text-secondary)] italic text-center py-4">No notes for this ticket.</p>
                         )}
                      </div>
                      <div className="flex gap-2">
                         <input 
                           placeholder="Add a private note..." 
                           value={note}
                           onChange={(e) => setNote(e.target.value)}
                           className="input-field py-2 text-sm flex-1"
                         />
                         <button onClick={handleAddNote} className="btn-primary py-2 px-4 text-xs">Add</button>
                      </div>
                   </div>

                   {/* TRANSFER SECTION */}
                   <div className="card p-6 border-purple-500/10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                        🚀 Transfer Ticket
                      </h3>
                      <div className="space-y-4">
                         <div>
                            <label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Target Department</label>
                            <select 
                              value={selectedDept}
                              onChange={(e) => setSelectedDept(e.target.value)}
                              className="input-field text-sm py-2"
                            >
                               <option value="">Select Department...</option>
                               {departments.filter(d => d._id !== staff?.department?._id).map(d => (
                                 <option key={d._id} value={d._id}>{d.name}</option>
                               ))}
                            </select>
                         </div>

                         <div>
                            <label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Queue Position</label>
                            <select 
                              value={targetPos}
                              onChange={(e) => setTargetPos(e.target.value)}
                              className="input-field text-sm py-2"
                            >
                               <option value="">End of Queue (Standard)</option>
                               <option value="1">1st Position (Priority)</option>
                               <option value="2">2nd Position (Fast-track)</option>
                            </select>
                         </div>

                         <div>
                            <label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Internal Note (Private)</label>
                            <textarea 
                              placeholder="Reason for transfer (e.g. Paid fees, needs stamp)..." 
                              value={transferNote}
                              onChange={(e) => setTransferNote(e.target.value)}
                              className="input-field text-sm py-2 min-h-[80px]"
                            />
                         </div>

                         <button 
                           onClick={handleTransfer}
                           disabled={!selectedDept}
                           className="btn-secondary w-full py-3 text-sm border-purple-500/20 hover:bg-purple-500/10 text-purple-400 font-bold"
                         >
                            Confirm Transfer
                         </button>
                      </div>
                   </div>
                            </div>
                </div>
              )}

               {/* STATS */}
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="card text-center py-6">
                     <p className="text-xs uppercase text-[var(--text-secondary)]">Waiting</p>
                     <p className="text-3xl font-bold text-[var(--accent-primary)]">{stats.waiting}</p>
                  </div>
                  <div className="card text-center py-6 border-yellow-500/20">
                     <p className="text-xs uppercase text-yellow-600">On Hold</p>
                     <p className="text-3xl font-bold text-yellow-500">{stats.onHold}</p>
                  </div>
                  <div className="card text-center py-6 border-purple-500/20">
                     <p className="text-xs uppercase text-purple-600">Serving</p>
                     <p className="text-3xl font-bold text-purple-500">{stats.serving}</p>
                  </div>
                  <div className="card text-center py-6">
                     <p className="text-xs uppercase text-[var(--text-secondary)]">Served</p>
                     <p className="text-3xl font-bold text-green-500">{stats.served}</p>
                  </div>
                  <div className="card text-center py-6">
                     <p className="text-xs uppercase text-[var(--text-secondary)]">Total</p>
                     <p className="text-3xl font-bold text-[var(--text-primary)]">{stats.total}</p>
                  </div>
               </div>

               {/* FULL QUEUE OVERVIEW (Detailed List) */}
               <div className="card p-0 overflow-hidden border-blue-500/10">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                       📋 Full Queue Overview
                     </h3>
                     <span className="text-[10px] font-black bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] px-2 py-1 rounded-full">
                        {allTickets.length} ACTIVE TICKETS
                     </span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-[var(--text-secondary)] font-bold border-b border-white/5">
                           <tr>
                              <th className="px-6 py-4">Ticket</th>
                              <th className="px-6 py-4">Student</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Position</th>
                              <th className="px-6 py-4">Time</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {allTickets.length > 0 ? allTickets.map((t) => (
                              <tr key={t._id} className={`hover:bg-white/5 transition-colors ${t.ticketNumber === currentTicket ? 'bg-[var(--accent-primary)]/5' : ''}`}>
                                 <td className="px-6 py-4 font-black text-[var(--text-primary)]">{t.ticketNumber}</td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="font-bold">{t.studentName || "Guest"}</span>
                                       <span className="text-[10px] opacity-40">{t.studentID || "GUEST"}</span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                       <span className={`px-2 py-1 rounded text-[10px] font-black uppercase inline-block w-fit ${
                                          t.status === 'serving' ? 'bg-purple-500/10 text-purple-500' :
                                          t.status === 'hold' ? 'bg-amber-500/10 text-amber-500' :
                                          t.status === 'waiting' ? 'bg-blue-500/10 text-blue-500' :
                                          'bg-slate-500/10 text-slate-500'
                                       }`}>
                                          {t.status}
                                       </span>
                                       {t.status === 'hold' && t.holdAt && (
                                          <span className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                                             <Clock size={10} /> {Math.floor((new Date() - new Date(t.holdAt)) / 60000)}m away
                                          </span>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 font-mono text-[var(--text-secondary)]">
                                    {t.status === 'waiting' ? `#${t.waitingPosition}` : t.status === 'serving' ? 'SERVICING' : '--'}
                                 </td>
                                 <td className="px-6 py-4 text-[10px] opacity-40">
                                    {new Date(t.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </td>
                              </tr>
                           )) : (
                              <tr>
                                 <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-secondary)] italic">
                                    The queue is currently empty.
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

                {/* ACTIVITY FEED */}
                <div className="card p-6 border-blue-500/10">
                   <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                     📡 Live Activity Feed
                   </h3>
                   <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {activityFeed.length > 0 ? activityFeed.map(act => (
                          <motion.div 
                            key={act.id} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0"
                          >
                             <span className="text-[var(--text-primary)]">{act.message}</span>
                             <span className="text-xs opacity-40">{act.time}</span>
                          </motion.div>
                        )) : (
                          <p className="text-xs text-[var(--text-secondary)] italic text-center py-2">No recent activity.</p>
                        )}
                      </AnimatePresence>
                   </div>
                </div>

             

           </div>
        )}


        {/* TAB: STUDENT HELPDESK */}
        {activeTab === "helpdesk" && (
           <div className="animate-fade-in space-y-6">
              <div className="card p-6 border-cyan-500/20 bg-cyan-500/5">
                 <h3 className="text-xl font-black text-[var(--text-primary)]">Student problems</h3>
                 <p className="text-sm text-[var(--text-secondary)] mt-1">Review requests and solve them remotely whenever possible. Ask the student to visit only when necessary.</p>
              </div>
              {supportRequests.length === 0 && <div className="card p-10 text-center text-[var(--text-secondary)]">No student support requests yet.</div>}
              {supportRequests.map((request) => (
                <div key={request._id} className="card p-6 border-white/10 space-y-4">
                   <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div><h4 className="text-lg font-black text-[var(--text-primary)]">{request.subject}</h4><p className="text-xs text-[var(--text-secondary)] mt-1">{request.student?.fullName} · {request.student?.email} · {new Date(request.createdAt).toLocaleString()}</p></div>
                      <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-white/10 text-[var(--text-secondary)]">{request.status.replace("-", " ")}</span>
                   </div>
                   <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{request.description}</p>
                   {request.staffResponse && <p className="text-sm text-emerald-400">Previous response: {request.staffResponse}</p>}
                   <textarea value={supportReply[request._id] || ""} onChange={(event) => setSupportReply((current) => ({ ...current, [request._id]: event.target.value }))} rows={3} placeholder="Write instructions or explain what the student should do..." className="input-field w-full resize-none" />
                   <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleSupportUpdate(request._id, "in-progress")} className="rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-300">Start review</button>
                      <button onClick={() => handleSupportUpdate(request._id, "resolved")} className="rounded-xl bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">Resolved remotely</button>
                      <button onClick={() => handleSupportUpdate(request._id, "visit-required")} className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-black text-red-300">Ask student to visit</button>
                      <button onClick={() => handleSupportUpdate(request._id, "closed")} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-[var(--text-secondary)]">Close request</button>
                   </div>
                </div>
              ))}
           </div>
        )}


        {/* TAB: APPOINTMENTS */}
        {activeTab === "appointments" && (
           <div className="animate-fade-in space-y-8">
              <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-blue-500/10">
                 <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Scheduled Appointments</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Manage upcoming student visits for your department.</p>
                 </div>
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                    <Calendar size={18} className="text-[var(--accent-primary)]" />
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent border-none text-[var(--text-primary)] text-sm focus:ring-0"
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 {appointments.length > 0 ? appointments.map((appt) => (
                    <div key={appt._id} className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[var(--accent-primary)]/30 transition-all group">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-[var(--accent-primary)]/10 rounded-2xl flex flex-col items-center justify-center border border-[var(--accent-primary)]/20">
                             <Clock size={20} className="text-[var(--accent-primary)] mb-1" />
                             <span className="text-xs font-black text-[var(--accent-primary)]">{appt.timeSlot}</span>
                          </div>
                          <div>
                             <h4 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                                {appt.user?.fullName || "Unknown Student"}
                             </h4>
                             <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                                <span className="opacity-60">Purpose:</span> {appt.purpose}
                             </p>
                             <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/5 text-[var(--text-secondary)] border border-white/5">
                                   ID: {appt.user?.studentID || "N/A"}
                                </span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                             appt.status === 'checked-in' 
                             ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                             : appt.status === 'booked'
                             ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                             : "bg-red-500/10 text-red-500 border border-red-500/20"
                          }`}>
                             {appt.status === 'checked-in' ? <CheckCircle size={16} /> : appt.status === 'booked' ? <Clock size={16} /> : <XCircle size={16} />}
                             <span className="capitalize">{appt.status.replace('-', ' ')}</span>
                          </div>
                       </div>
                    </div>
                 )) : (
                    <div className="card p-12 text-center border-dashed">
                       <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar size={32} className="text-[var(--text-secondary)] opacity-20" />
                       </div>
                       <h4 className="text-[var(--text-primary)] font-bold">No Appointments Found</h4>
                       <p className="text-[var(--text-secondary)] text-sm mt-1">There are no appointments scheduled for this date.</p>
                    </div>
                 )}
              </div>
           </div>
        )}


        {/* TAB: EMERGENCY HISTORY */}
        {activeTab === "history" && (
           <div className="animate-fade-in space-y-8">
              <div className="card p-0 overflow-hidden border-red-500/10">
                 <h3 className="p-6 font-bold border-b border-[var(--glass-border)] flex items-center gap-3">
                    <RotateCcw className="text-red-500" /> All Emergency Requests
                 </h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] text-[var(--text-secondary)]">
                          <tr>
                             <th className="px-6 py-4">Student</th>
                             <th className="px-6 py-4">Reason</th>
                             <th className="px-6 py-4">Status</th>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[var(--glass-border)]">
                          {allEmergencies.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[var(--text-secondary)]">No history.</td></tr> : 
                            allEmergencies.map(e => (
                               <tr key={e._id} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4">
                                     <div className="font-bold text-[var(--text-primary)]">{e.student?.name}</div>
                                     <div className="text-[10px] opacity-40 uppercase tracking-tighter">{e.student?.email}</div>
                                  </td>
                                  <td className="px-6 py-4 max-w-xs">
                                     <p className="truncate text-[var(--text-secondary)]" title={e.reason}>{e.reason}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                      e.status === 'resolved' ? 'bg-green-500/10 text-green-500' : 
                                      e.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 
                                      e.status === 'active' ? 'bg-yellow-500/10 text-yellow-500' : 
                                      'bg-slate-500/10 text-slate-500'
                                    }`}>
                                       {e.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs opacity-60">
                                     {new Date(e.createdAt).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4">
                                     <div className="flex gap-3">
                                        {e.proof && (
                                           <a 
                                             href={`${import.meta.env.VITE_API_URL.replace("/api", "")}${e.proof}`} 
                                             target="_blank" 
                                             rel="noreferrer"
                                             className="text-[var(--accent-primary)] font-bold text-xs hover:underline flex items-center gap-1"
                                           >
                                              <Info size={12} /> View Proof
                                           </a>
                                        )}
                                     </div>
                                  </td>
                               </tr>
                            ))
                          }
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

        {/* TAB 2: SETTINGS */}
        {activeTab === "settings" && (
           <div className="animate-fade-in max-w-2xl mx-auto space-y-8">
              
              <div className="card p-8 flex items-center justify-between border-blue-500/20">
                 <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Pause Queue (Break)</h3>
                    <p className={`text-sm mt-1 font-medium ${isPaused ? "text-yellow-500" : "text-[var(--text-secondary)]"}`}>
                       {isPaused ? "Queue is currently paused" : "Queue is active"}
                    </p>
                 </div>
                 <button onClick={handleTogglePause} className={`px-6 py-3 rounded-xl font-bold transition-all ${isPaused ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white/5 text-[var(--text-primary)] border border-[var(--glass-border)] hover:bg-white/10"}`}>
                    {isPaused ? "Resume Queue" : "Pause for Break"}
                 </button>
              </div>

              <div className="card p-8">
                 <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Extend Queue Limit</h3>
                 <p className="text-sm text-[var(--text-secondary)] mb-6">Increase the maximum number of tickets allowed for today.</p>
                 <div className="flex gap-4">
                    <input 
                      type="number" 
                      placeholder="Amount to add" 
                      value={increaseBy} 
                      onChange={(e) => setIncreaseBy(e.target.value)}
                      className="input-field" 
                    />
                    <button onClick={handleIncreaseLimit} className="btn-primary">Add</button>
                 </div>
              </div>

              <div className="card p-8 border-purple-500/20">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                       <Megaphone size={20} className="text-purple-500" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Department Broadcast</h3>
                 </div>
                 <p className="text-sm text-[var(--text-secondary)] mb-6">Send an announcement to all students currently in your queue.</p>
                 <div className="space-y-4">
                    <textarea 
                      placeholder="Type your message here..." 
                      value={broadcastMsg} 
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      className="input-field min-h-[100px] resize-none" 
                    />
                    <button 
                      onClick={handleSendBroadcast} 
                      disabled={!broadcastMsg.trim()}
                      className="btn-primary w-full bg-purple-600 hover:bg-purple-700 border-none flex items-center justify-center gap-2"
                    >
                       <Megaphone size={18} />
                       Send Broadcast
                    </button>
                 </div>
              </div>
           </div>
        )}


        {/* TAB 3: QR GENERATOR */}
        {activeTab === "qr" && (
           <div className="animate-fade-in max-w-md mx-auto text-center">
              <div className="card p-12">
                 <h3 className="text-xl font-bold text-[var(--text-primary)] mb-8">Department QR Code</h3>
                 
                 {qrData ? (
                   <div className="space-y-6">
                      <div className="bg-white p-4 rounded-2xl inline-block">
                         <img src={qrData.qrCode} alt="QR Code" className="w-64 h-64 object-contain" />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] break-all font-mono bg-[var(--bg-secondary)] p-3 rounded-lg select-all">
                        {qrData.joinUrl}
                      </p>
                   </div>
                 ) : (
                    <div className="py-12">
                       <p className="text-[var(--text-secondary)] mb-6">Generate a QR code for students to join quickly.</p>
                       <button 
                         onClick={handleGenerateQR}
                         disabled={qrLoading} 
                         className="btn-primary w-full"
                        >
                         {qrLoading ? "Generating..." : "Generate QR Code"}
                       </button>
                    </div>
                 )}
              </div>
           </div>
        )}
        </motion.div>
        </AnimatePresence>


        {/* TOAST MESSAGE */}
        {message && (
           <div className="fixed bottom-6 right-6 z-50 animate-fade-in bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl border border-white/10">
              {message}
           </div>
        )}

      </main>
    </div>
  );
}
