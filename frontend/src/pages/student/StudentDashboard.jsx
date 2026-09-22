import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Megaphone, Users, User, Clock, AlertTriangle, CheckCircle, Info, LayoutDashboard, PlusCircle, Calendar, Coffee, RotateCcw, Trophy, Zap, Flame, Map as MapIcon, TrendingUp, HelpCircle } from "lucide-react";
import {
  getDepartments,
  joinQueue,
  getMyActiveTicket,
  cancelQueue,
  getCrowdStatus,
  getMyTicketHistory,
  getDepartmentTraffic,
  restoreTicket,
  toggleHold,
} from "../../services/student";
import { socket } from "../../services/socket";
import FeedbackModal from "../../components/student/FeedbackModal";
import { submitFeedback } from "../../services/student";
import api from "../../services/api";
import DashboardSidebar from "../../components/DashboardSidebar";
import toast from "react-hot-toast";
import QueueRunner from "../../components/student/QueueRunner";
import StudentHelpdesk from "../../components/student/StudentHelpdesk";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const [departments, setDepartments] = useState([]);
  const [joinDept, setJoinDept] = useState("");
  const [statusDept, setStatusDept] = useState("");

  const [ticketInfo, setTicketInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [servingTickets, setServingTickets] = useState([]);
  const [myDepartmentId, setMyDepartmentId] = useState(null);

  const [queueOpen, setQueueOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState("");
  const [crowdStatus, setCrowdStatus] = useState(null);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [emergencyHistory, setEmergencyHistory] = useState([]);

  const [feedbackTicketId, setFeedbackTicketId] = useState(null);
  const [emergencyRequested, setEmergencyRequested] = useState(false);
  
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyProof, setEmergencyProof] = useState(null);

  const [trafficData, setTrafficData] = useState([]);

  const chartData = useMemo(() => {
    const fullDay = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      display: `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i >= 12 ? 'PM' : 'AM'}`,
      count: 0
    }));

    trafficData.forEach(d => {
      if (fullDay[d._id]) fullDay[d._id].count = d.count;
    });

    // Only show business hours 8am - 6pm for better UI
    return fullDay.slice(8, 19);
  }, [trafficData]);

  const [noShowTicket, setNoShowTicket] = useState(null);
  const [graceTime, setGraceTime] = useState(0);
  const [arrivalTimeLeft, setArrivalTimeLeft] = useState(0);
  const [initialWaitingPosition, setInitialWaitingPosition] = useState(null);
  const [badges, setBadges] = useState([]);

  // Appointment States
  const [appointments, setAppointments] = useState([]);
  const [apptDept, setApptDept] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptPurpose, setApptPurpose] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);

  const joinedRoomRef = useRef(false);

  useEffect(() => {
    if (ticketInfo && !initialWaitingPosition) {
      setTimeout(() => {
        setInitialWaitingPosition(ticketInfo.waitingPosition);
      }, 0);
    } else if (!ticketInfo && initialWaitingPosition) {
      setTimeout(() => {
        setInitialWaitingPosition(null);
      }, 0);
    }
  }, [ticketInfo, initialWaitingPosition]);

  const resetState = (msg) => {
    setTicketInfo(null);
    setMyDepartmentId(null);
    setJoinDept("");
    setServingTickets([]);
    setMessage(msg);
    joinedRoomRef.current = false;
  };

  const joinRoomOnce = useCallback((departmentId) => {
    if (!departmentId || joinedRoomRef.current) return;
    const id = typeof departmentId === "object" ? departmentId._id || departmentId.toString() : departmentId;
    socket.emit("join_department", id);
    if (ticketInfo?._id) socket.emit("join_ticket", ticketInfo._id);
    joinedRoomRef.current = true;
  }, [ticketInfo]);

  const refreshTicketInfo = useCallback(async () => {
    try {
      const ticket = await getMyActiveTicket();
      if (ticket) {
        setTicketInfo(ticket);
        setMyDepartmentId(ticket.departmentId);
      } else if (ticketInfo) {
        setTicketInfo(null);
        setMyDepartmentId(null);
      }
    } catch (err) {
      console.error("Failed to refresh ticket info:", err);
    }
  }, [ticketInfo]);

  const fetchServingTickets = useCallback(async (deptId) => {
    if (!deptId) return;
    try {
      const res = await api.get(`/queue/current-serving/${deptId}`);
      setServingTickets(res.data.servingTickets || []);
    } catch (err) {
      console.error("Failed to fetch serving tickets:", err);
    }
  }, []);

  /* SOCKET & DATA LOADING logic (Identical to original) */
  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onEmergencyStarted = (data) => {
      setServingTickets([{ ticketNumber: "EMERGENCY" }]);
      setMessage(data?.note || "🚨 Emergency in progress. Please wait.");
      toast.error("🚨 Emergency Alert: Queue paused.", { icon: "🔥", duration: 6000 });
    };
    const onEmergencyEnded = () => {
      setEmergencyRequested(false);
      setServingTickets([]);
      setMessage("Emergency resolved. Queue resumed.");
      toast.success("Emergency resolved. Queue resumed!", { icon: "✅" });
      refreshTicketInfo();
      if (myDepartmentId || joinDept) fetchServingTickets(myDepartmentId || joinDept);
    };
    const onTicketCalled = (data) => {
      setServingTickets(prev => {
        const otherTickets = prev.filter(t => t.servedBy !== data.servedBy && t.ticketNumber !== "EMERGENCY");
        return [...otherTickets, { ticketNumber: data.ticketNumber, servedBy: data.servedBy, priority: data.priority }];
      });
      if (ticketInfo && data.ticketNumber === ticketInfo.ticketNumber) {
        toast.success("🎯 It's Your Turn! Proceed to the counter.", {
          duration: 10000,
          position: "top-center",
        });
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
        
        // Browser Notification
        if (Notification.permission === "granted") {
          new Notification("It's Your Turn!", {
            body: `Ticket ${data.ticketNumber} is being served now. Please proceed.`,
            icon: "/favicon.ico"
          });
        }
      }
      refreshTicketInfo();
    };
    const onTicketCompleted = (data) => {
      setServingTickets(prev => prev.filter(t => t.ticketNumber !== data.ticketNumber));
      if (ticketInfo && data.ticketNumber === ticketInfo.ticketNumber) {
        resetState("Your ticket has been completed. You may join again.");
        toast.success("Ticket Completed! Hope we served you well.");
      }
      refreshTicketInfo();
    };
    const onTicketCancelled = () => {
      resetState("You have left the queue.");
      refreshTicketInfo();
    };
    const onQueueStatusChanged = (data) => setQueueOpen(data.isOpen);
    const onEmergencyYourTurn = () => {
      setServingTickets([{ ticketNumber: "EMERGENCY" }]);
      setMessage("🚨 It’s your turn. Please proceed immediately.");
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    };
    const onEmergencyServed = () => {
      setEmergencyRequested(false);
      setServingTickets([]);
      setMessage("✅ You have been served. Thank you.");
      joinedRoomRef.current = false;
    };
    const onEmergencyApproved = () => {
      toast.success("Your emergency request has been APPROVED!");
      refreshTicketInfo(); 
    };
    const onEmergencyRejected = () => {
      setMessage("❌ Your emergency request was rejected. Please stay in the regular queue.");
      setEmergencyRequested(false);
    };

    const onPauseToggled = (data) => {
      setIsPaused(data.isPaused);
      setPauseMessage(data.pauseMessage);
      if (data.isPaused) {
        toast.error("⏸️ Queue Paused: Staff is on a break.", { icon: "☕" });
      } else {
        toast.success("▶️ Queue Resumed!", { icon: "✅" });
      }
    };

    const onNoShow = (data) => {
      if (ticketInfo && data.ticketNumber === ticketInfo.ticketNumber) {
        setNoShowTicket(ticketInfo);
        setGraceTime(300); // 5 minutes
        resetState("You were marked as no-show.");
        toast.error("You were marked as no-show! You have 5 minutes to restore your position.");
      }
      refreshTicketInfo();
    };

    const onBroadcast = (data) => {
      toast(
        <div>
          <p className="font-bold text-xs uppercase tracking-widest text-[var(--accent-primary)] mb-1">
            📢 {data.staffName || "Staff"} Announcement
          </p>
          <p>{data.message}</p>
        </div>,
        {
          duration: 8000,
          style: {
            borderRadius: "16px",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            padding: "16px",
          },
        }
      );
    };

    const onTicketTransferred = (data) => {
      setMyDepartmentId(data.departmentId);
      setJoinDept(data.departmentId);
      joinedRoomRef.current = false;
      joinRoomOnce(data.departmentId);
      refreshTicketInfo();
      fetchServingTickets(data.departmentId);
      toast.success(`Ticket transferred to ${data.toDepartmentName}`, { icon: "🚀" });
    };

    const onHoldToggled = (data) => {
      setTicketInfo(prev => {
        if (prev && data.ticketId === prev._id) {
          toast.success(`Position ${data.status === 'hold' ? 'Paused' : 'Resumed'}`);
          return { ...prev, status: data.status };
        }
        return prev;
      });
    };

    socket.on("ticket_called", onTicketCalled);
    socket.on("ticket_completed", onTicketCompleted);
    socket.on("ticket_cancelled", onTicketCancelled);
    socket.on("queue_status_changed", onQueueStatusChanged);
    socket.on("emergency_started", onEmergencyStarted);
    socket.on("emergency_ended", onEmergencyEnded);
    socket.on("emergency_your_turn", onEmergencyYourTurn);
    socket.on("emergency_served", onEmergencyServed);
    socket.on("emergency_approved", onEmergencyApproved);
    socket.on("emergency_rejected", onEmergencyRejected);
    socket.on("queue_pause_toggled", onPauseToggled);
    socket.on("you_marked_no_show", onNoShow);
    socket.on("ticket_joined", refreshTicketInfo);
    socket.on("ticket_transferred", onTicketTransferred);
    socket.on("broadcast", onBroadcast);
    socket.on("ticket_hold_toggled", onHoldToggled);

    return () => {
      socket.off("ticket_called", onTicketCalled);
      socket.off("ticket_completed", onTicketCompleted);
      socket.off("ticket_cancelled", onTicketCancelled);
      socket.off("queue_status_changed", onQueueStatusChanged);
      socket.off("emergency_started", onEmergencyStarted);
      socket.off("emergency_ended", onEmergencyEnded);
      socket.off("emergency_your_turn", onEmergencyYourTurn);
      socket.off("emergency_served", onEmergencyServed);
      socket.off("emergency_approved", onEmergencyApproved);
      socket.off("emergency_rejected", onEmergencyRejected);
      socket.off("queue_pause_toggled", onPauseToggled);
      socket.off("you_marked_no_show", onNoShow);
      socket.off("ticket_joined", refreshTicketInfo);
      socket.off("ticket_transferred", onTicketTransferred);
      socket.off("broadcast", onBroadcast);
      socket.off("ticket_hold_toggled", onHoldToggled);
    };
  }, [myDepartmentId, joinDept, refreshTicketInfo, fetchServingTickets, joinRoomOnce, ticketInfo]);

  useEffect(() => {
    if (!joinDept) return;
    const init = async () => {
      try {
        const res = await api.get("/student/emergency-status", { params: { departmentId: joinDept } });
        if (res.data?.active) {
          setServingTickets([{ ticketNumber: "EMERGENCY" }]);
          setMessage("🚨 Emergency in progress. Please wait.");
        }
      } catch (err) {
        console.error("Check emergency failed:", err);
      }
      await fetchServingTickets(joinDept);
    };
    init();
  }, [joinDept, fetchServingTickets]);

  useEffect(() => {
    const fetchTraffic = async () => {
      if (!joinDept) {
        setTrafficData([]);
        return;
      }
      try {
        const data = await getDepartmentTraffic(joinDept);
        setTrafficData(data);
      } catch (err) {
        console.error("Fetch traffic failed:", err);
      }
    };
    fetchTraffic();
  }, [joinDept]);

  useEffect(() => {
    const restoreTicketEffect = async () => {
      try {
        const ticket = await getMyActiveTicket();
        if (ticket) {
          setTicketInfo(ticket);
          setMyDepartmentId(ticket.departmentId);
          setJoinDept(ticket.departmentId);
          joinRoomOnce(ticket.departmentId);
        }
      } catch (err) {
        console.error("Restore ticket failed:", err);
      }
    };
    restoreTicketEffect();
  }, [joinRoomOnce]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.id || payload._id) socket.emit("join_user", payload.id || payload._id);
        } catch (err) {
            console.error("Token decode failed:", err);
        }
    }
    const fetchDeps = async () => {
       try { setDepartments(await getDepartments()); } catch (err) { console.error("Fetch departments failed:", err); }
    };
    fetchDeps();
    
    const fetchHistory = async () => {
        try { 
            const history = await getMyTicketHistory();
            setTicketHistory(history); 
            const res = await api.get("/student/emergency-history");
            setEmergencyHistory(res.data);
            
            // 🏅 Calculate Badges (Gamification)
            const newBadges = [];
            if (history.length >= 5) newBadges.push({ name: "Queue Veteran", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" });
            if (history.some(t => new Date(t.joinedAt).getHours() < 10)) newBadges.push({ name: "Early Bird", icon: Zap, color: "text-blue-500", bg: "bg-blue-500/10" });
            if (history.some(t => t.status === 'completed')) newBadges.push({ name: "Good Citizen", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" });
            setBadges(newBadges);

            // 🔥 Check for any active or pending emergency requests
            const activeRequest = res.data.find(e => e.status === "pending" || e.status === "approved" || e.status === "active");
            if (activeRequest) {
                setEmergencyRequested(true);
            }
        } catch (err) {
            console.error("Fetch history failed:", err);
        }
    };
    fetchHistory();

    const fetchAppts = async () => {
      try {
        const res = await api.get("/appointments/my");
        setAppointments(res.data);
      } catch (err) {
        console.error("Fetch appointments failed:", err);
      }
    };
    fetchAppts();
  }, []);

  useEffect(() => {
      if (joinDept) joinRoomOnce(joinDept);
  }, [joinDept, joinRoomOnce]);

  useEffect(() => {
    const fetchCrowd = async () => {
      if (!statusDept) { setCrowdStatus(null); return; }
      try { setCrowdStatus(await getCrowdStatus(statusDept)); } catch (err) { console.error("Fetch crowd status failed:", err); setCrowdStatus(null); }
    };
    fetchCrowd();
  }, [statusDept]);

  useEffect(() => {
    if (graceTime <= 0) {
      if (noShowTicket) {
        setTimeout(() => setNoShowTicket(null), 0);
      }
      return;
    }
    const timer = setInterval(() => setGraceTime(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [graceTime, noShowTicket]);

  useEffect(() => {
    if (ticketInfo?.status !== "serving" || !ticketInfo.calledAt) {
      setArrivalTimeLeft(0);
      return;
    }

    const updateArrivalTime = () => {
      const elapsed = Math.floor((Date.now() - new Date(ticketInfo.calledAt).getTime()) / 1000);
      setArrivalTimeLeft(Math.max(0, 300 - elapsed));
    };

    updateArrivalTime();
    const timer = setInterval(updateArrivalTime, 1000);
    return () => clearInterval(timer);
  }, [ticketInfo?.status, ticketInfo?.calledAt]);

  const [showDeflection, setShowDeflection] = useState(false);
  const [deflectionContent, setDeflectionContent] = useState(null);

  const handleJoinQueue = async () => {
    if (!joinDept) return;
    
    // 🔥 AI DEFLECTION LOGIC
    const dept = departments.find(d => d._id === joinDept);
    const keywords = ["financial", "scholarship", "registrar", "transcript", "id card"];
    const nameMatch = keywords.some(k => dept?.name?.toLowerCase().includes(k));

    if (nameMatch) {
      setDeflectionContent({
        title: `Wait! Before you join the ${dept.name} queue...`,
        advice: `80% of students asking about this found the answer in our FAQ or Online Portal.`,
        link: "https://campus.edu/self-service-portal",
        label: "Visit Self-Service Portal"
      });
      setShowDeflection(true);
    } else {
      executeJoinQueue();
    }
  };

  const proceedToJoin = () => {
    setShowDeflection(false);
    executeJoinQueue();
  };

  const executeJoinQueue = async () => {
    try {
      const data = await joinQueue(joinDept);
      setTicketInfo(await getMyActiveTicket());
      setMyDepartmentId(joinDept);
      setMessage(data.message);
      joinRoomOnce(joinDept);
      toast.success("your queue ticket is created");
      setActiveTab("dashboard"); 
    } catch (err) { 
      const errorMessage = err.response?.data?.message || "Failed to join queue";
      setMessage(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleCancelQueue = async () => {
    try {
      const res = await cancelQueue(myDepartmentId);
      resetState(res.message);
    } catch { setMessage("Failed to leave queue"); }
  };

  const handleToggleHold = async () => {
    try {
      const res = await toggleHold();
      setTicketInfo(prev => ({ ...prev, status: res.status }));
      toast.success(res.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle hold");
    }
  };

  const handleRestoreTicket = async () => {
    if (!noShowTicket) return;
    try {
      const res = await restoreTicket(noShowTicket._id);
      setTicketInfo(await getMyActiveTicket());
      setMyDepartmentId(noShowTicket.departmentId);
      setJoinDept(noShowTicket.departmentId);
      setNoShowTicket(null);
      setGraceTime(0);
      toast.success(res.message);
      setActiveTab("dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to restore position");
    }
  };

  const handleSubmitEmergencyForm = async () => {
    const deptId = joinDept || myDepartmentId;
    if (!deptId) return setMessage("Please select a department first");
    if (!emergencyReason) return setMessage("Please provide a description");
    if (!emergencyProof) return setMessage("Please upload a proof file");

    try {
      const formData = new FormData();
      formData.append("departmentId", deptId);
      formData.append("reason", emergencyReason);
      formData.append("proof", emergencyProof);
      
      await toast.promise(
        api.post("/student/emergency-request", formData),
        {
          loading: 'Sending emergency request...',
          success: 'Request sent! Waiting for staff approval.',
          error: (err) => err.response?.data?.message || 'Failed to send request'
        }
      );

      setEmergencyRequested(true);
      setShowEmergencyForm(false);
      setEmergencyReason("");
      setEmergencyProof(null);
      setActiveTab("dashboard"); 
    } catch { 
      // Error handled by toast.promise
    }
  };

  const handleSubmitFeedback = async (payload) => {
    try {
      await submitFeedback(payload);
      setFeedbackTicketId(null);
      setMessage("Thank you for your feedback.");
      setTicketHistory(await getMyTicketHistory());
    } catch (err) { alert(err.message); }
  };

  useEffect(() => {
    if (apptDept && apptDate) {
      const fetchSlots = async () => {
        try {
          const res = await api.get("/appointments/available", {
            params: { departmentId: apptDept, date: apptDate }
          });
          setAvailableSlots(res.data);
        } catch (err) {
          console.error("Fetch slots failed:", err);
        }
      };
      fetchSlots();
    }
  }, [apptDept, apptDate]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.post("/appointments/book", {
        departmentId: apptDept,
        appointmentDate: apptDate,
        timeSlot: apptTime,
        purpose: apptPurpose
      });
      toast.success("Appointment booked successfully!");
      setApptDept("");
      setApptDate("");
      setApptTime("");
      setApptPurpose("");
      const res = await api.get("/appointments/my");
      setAppointments(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed");
    }
  };

  const handleCancelAppointment = async (id) => {
    try {
      await api.put(`/appointments/cancel/${id}`);
      toast.success("Appointment cancelled");
      const res = await api.get("/appointments/my");
      setAppointments(res.data);
    } catch {
      toast.error("Cancellation failed");
    }
  };

  const handleHelpdeskDepartment = (departmentName) => {
    const department = departments.find((item) =>
      item.name.toLowerCase().includes(departmentName.toLowerCase())
    );

    if (!department) {
      toast.error(`${departmentName} is not currently available.`);
      return;
    }

    setJoinDept(department._id);
    setActiveTab("join");
    toast.success(`${department.name} selected. You can join its queue now.`);
  };

  const tabs = [
    { id: "dashboard", label: "Queue Visuals", icon: LayoutDashboard },
    { id: "join", label: "Join Queue", icon: PlusCircle },
    { id: "helpdesk", label: "Self-Service Help", icon: HelpCircle },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "history", label: "My History", icon: RotateCcw },
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
       <DashboardSidebar title="Student Panel" tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
       
       <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 transition-all duration-300">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
               <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                  {activeTab === "dashboard" && "Queue Visuals"}
                  {activeTab === "join" && "Join a Queue"}
                      {activeTab === "helpdesk" && "Student Self-Service"}
                  {activeTab === "history" && "Ticket History"}
               </h1>
            </div>
          </header>

          {activeTab === "dashboard" && (
             <div className="animate-fade-in space-y-10">
                {/* NO-SHOW GRACE PERIOD BANNER */}
                {noShowTicket && (
                   <div className="bg-red-500 text-white p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                      <div className="flex items-center gap-4 text-center md:text-left">
                         <div className="bg-white/20 p-3 rounded-full"><AlertTriangle size={32} /></div>
                         <div>
                            <h4 className="text-xl font-black uppercase">You were missed!</h4>
                            <p className="font-bold opacity-90">Restore Ticket {noShowTicket.ticketNumber} before it's too late.</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-center bg-black/20 px-4 py-2 rounded-2xl">
                            <p className="text-[10px] uppercase font-black opacity-60">Expires In</p>
                            <p className="text-2xl font-mono font-black">{Math.floor(graceTime / 60)}:{String(graceTime % 60).padStart(2, '0')}</p>
                         </div>
                         <button 
                           onClick={handleRestoreTicket}
                           className="bg-white text-red-600 px-8 py-3 rounded-xl font-black hover:scale-105 transition-transform shadow-lg"
                         >
                           I'M HERE!
                         </button>
                      </div>
                   </div>
                )}

                {/* PENDING EMERGENCY REQUEST BANNER */}
                {emergencyRequested && !ticketInfo && !noShowTicket && (
                   <div className="bg-yellow-500/10 border-2 border-yellow-500/20 text-yellow-600 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                      <div className="flex items-center gap-4 text-center md:text-left">
                         <div className="bg-yellow-500/20 p-3 rounded-full"><Clock size={32} /></div>
                         <div>
                            <h4 className="text-xl font-black uppercase">Emergency Request Pending</h4>
                            <p className="font-bold opacity-70">Staff is currently reviewing your proof and reason. Please stay nearby.</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 bg-yellow-500 text-white px-6 py-2 rounded-full font-black text-sm">
                         <Info size={16} /> WAITING FOR APPROVAL
                      </div>
                   </div>
                )}

                {/* ACTIVE TICKET HERO */}
                <AnimatePresence mode="wait">
                   {ticketInfo ? (
                      <motion.div 
                        key="active-ticket"
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                        transition={{ type: "spring", damping: 25, stiffness: 120 }}
                        className="nebula-card p-10 md:p-14 w-full relative overflow-hidden text-center animate-float"
                      >
                         {/* MESH GRADIENT OVERLAY */}
                         <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500 blur-[100px]" />
                            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500 blur-[100px]" />
                         </div>

                         {/* QUEUE PROGRESS BAR */}
                         {initialWaitingPosition > 0 && (
                           <div className="absolute top-0 left-0 w-full h-2 bg-white/5">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: `${Math.min(100, Math.max(5, ((initialWaitingPosition - (ticketInfo.waitingPosition - 1)) / (initialWaitingPosition || 1)) * 100))}%` 
                                }}
                                transition={{ duration: 2, ease: "circOut" }}
                              />
                              <div className="absolute top-5 right-8 text-[11px] font-black uppercase tracking-widest text-blue-400">
                                 Progress: {Math.round(Math.min(100, Math.max(5, ((initialWaitingPosition - (ticketInfo.waitingPosition - 1)) / (initialWaitingPosition || 1)) * 100)))}%
                              </div>
                           </div>
                         )}

                         <div className="relative z-10">
                            <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-400 mb-6 drop-shadow-sm">Your Active Ticket</p>
                            
                            {ticketInfo.priority === 2 && (
                               <div className="bg-red-500/20 text-red-400 px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 inline-flex items-center gap-2 border border-red-500/30 animate-pulse">
                                  <Flame size={14} /> Emergency Priority
                               </div>
                            )}

                            <motion.div
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.2, type: "spring" }}
                              className="relative inline-block mb-8"
                            >
                               <h3 className="text-8xl md:text-[10rem] font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                 {ticketInfo.ticketNumber}
                               </h3>
                               <div className="absolute -inset-4 bg-white/5 blur-2xl -z-10 rounded-full" />
                            </motion.div>

                            <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
                               <div className="bg-white/5 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/10 shadow-inner group transition-all hover:bg-white/10">
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Queue Position</p>
                                  <p className="font-black text-2xl text-white">
                                     {ticketInfo.waitingPosition === 1 ? "🎯 Next Up" : `#${ticketInfo.waitingPosition}`}
                                  </p>
                               </div>
                               <div className="bg-white/5 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/10 shadow-inner group transition-all hover:bg-white/10">
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Est. Wait Time</p>
                                  <p className="font-black text-2xl text-blue-400">~{ticketInfo.estimatedWaitTime}m</p>
                               </div>
                               <div className="bg-white/5 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/10 shadow-inner group transition-all hover:bg-white/10">
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Behind You</p>
                                  <p className="font-black text-2xl text-purple-400">{Math.max(0, crowdStatus?.waitingCount - ticketInfo.waitingPosition) || 0}</p>
                               </div>
                               {ticketInfo.status === "serving" && (
                                <div className={`px-8 py-3 rounded-2xl border shadow-inner ${arrivalTimeLeft > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Arrival Window</p>
                                  <p className={`font-black text-2xl font-mono ${arrivalTimeLeft > 0 ? "text-amber-400" : "text-red-400"}`}>
                                    {arrivalTimeLeft > 0 ? `${Math.floor(arrivalTimeLeft / 60)}:${String(arrivalTimeLeft % 60).padStart(2, "0")}` : "Expired"}
                                  </p>
                                </div>
                               )}
                            </div>
                         </div>
                         {/* WHILE YOU WAIT CONTENT */}
                         <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                            <div className="card p-6 bg-white/5 border-white/10">
                               <h4 className="text-sm font-black uppercase tracking-widest text-[var(--accent-primary)] mb-6 flex items-center gap-2">
                                  <Megaphone size={16} /> Campus Pulse (Real-time)
                               </h4>
                               <div className="space-y-6">
                                  {[
                                    { title: "Free Coffee @ Library", time: "2m ago", desc: "Show your active KIET Smart Queue ticket at the Library Cafe for a 50% discount!" },
                                    { title: "Career Fair Tomorrow", time: "1h ago", desc: "30+ companies visiting the Great Hall. Don't forget your CV." },
                                    { title: "Student Union Elections", time: "3h ago", desc: "Voting is now open. Every vote counts towards campus improvements." }
                                  ].map((news, i) => (
                                    <div key={i} className="group cursor-pointer">
                                       <div className="flex justify-between items-start mb-1">
                                          <p className="font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors">{news.title}</p>
                                          <span className="text-[10px] opacity-40 uppercase font-black">{news.time}</span>
                                       </div>
                                       <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{news.desc}</p>
                                    </div>
                                  ))}
                               </div>
                            </div>

                            <div className="card p-6 bg-indigo-500/5 border-indigo-500/20 relative overflow-hidden group">
                               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity" />
                               <h4 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                                  <Zap size={16} /> Queue Runner (BETA)
                               </h4>
                               <div className="bg-slate-900/50 rounded-2xl h-[160px] flex flex-col items-center justify-center text-center p-6 border border-white/5">
                                  <div className="mb-4 text-3xl animate-bounce">🏃💨</div>
                                  <p className="text-sm font-bold text-white mb-2">Beat the Queue!</p>
                                  <p className="text-[10px] text-[var(--text-secondary)] mb-4">Score 50+ to earn the "Patient Pro" badge.</p>
                                  <button 
                                    onClick={() => setActiveTab("game")}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-full text-xs font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                                  >
                                    Start Playing
                                  </button>
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex flex-wrap items-center justify-center gap-4 mt-12">
                            {(ticketInfo.status === 'waiting' || ticketInfo.status === 'hold') && (
                              <button 
                                onClick={handleToggleHold} 
                                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
                                  ticketInfo.status === 'hold' 
                                  ? "bg-amber-500 text-white hover:bg-amber-600" 
                                  : "bg-white/20 text-white border border-white/20 hover:bg-white/30"
                                }`}
                              >
                                {ticketInfo.status === 'hold' ? <RotateCcw size={18} /> : <Coffee size={18} />}
                                {ticketInfo.status === 'hold' ? "I'm Back" : "Step Away"}
                              </button>
                            )}
                            <button onClick={handleCancelQueue} className="bg-white/10 text-white border border-white/20 px-8 py-3 rounded-xl font-bold hover:bg-white/20 shadow-lg">
                              Leave Queue
                            </button>
                         </div>

                         {/* PAUSE MESSAGE OVERLAY */}
                         {isPaused && (
                           <motion.div 
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             className="absolute inset-0 bg-yellow-500/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-white"
                           >
                              <Clock size={48} className="mb-4 animate-bounce" />
                              <h3 className="text-2xl font-black uppercase">Queue Paused</h3>
                              <p className="font-medium mt-2 text-center max-w-xs">{pauseMessage || "The staff is currently on a short break. Please stay nearby."}</p>
                           </motion.div>
                         )}

                         {/* STEP AWAY OVERLAY */}
                         {ticketInfo.status === 'hold' && (
                           <motion.div 
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             className="absolute inset-0 bg-amber-500/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-white"
                           >
                              <Coffee size={48} className="mb-4 animate-bounce" />
                              <h3 className="text-2xl font-black uppercase">On Hold</h3>
                              <p className="font-medium mt-2 text-center max-w-xs">You've stepped away. Toggle "I'm Back" when you return to keep your spot.</p>
                              <button 
                                onClick={handleToggleHold}
                                className="mt-6 bg-white text-amber-600 px-8 py-3 rounded-xl font-black hover:scale-105 transition-transform shadow-lg"
                              >
                                I'M BACK
                              </button>
                           </motion.div>
                         )}
                      </motion.div>
                   ) : (
                      <motion.div 
                        key="empty-state"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="border border-dashed border-[var(--glass-border)] rounded-3xl p-12 w-full text-center"
                      >
                         <p className="text-[var(--text-secondary)] text-lg mb-4">You are not currently in any queue.</p>
                         <button onClick={() => setActiveTab("join")} className="btn-primary">
                            Join a Queue Now
                         </button>
                      </motion.div>
                   )}
                </AnimatePresence>

                {/* STATUS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {/* NOW SERVING */}
                   <div className="nebula-card p-8 flex flex-col items-center justify-center text-center">
                       <div className="bg-blue-500/10 p-3 rounded-2xl mb-4">
                          <Zap size={24} className="text-blue-400" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Now Serving</p>
                       <div className="flex flex-wrap justify-center gap-4">
                          {servingTickets.length > 0 ? servingTickets.map((t, idx) => (
                             <motion.div 
                                key={idx} 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`bg-white/5 border px-5 py-3 rounded-2xl min-w-[90px] backdrop-blur-md ${t.priority === 2 ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-white/10'}`}
                             >
                                <div className="flex flex-col items-center">
                                   <span className={`text-3xl font-black ${t.priority === 2 ? 'text-red-400' : 'text-blue-400'}`}>{t.ticketNumber}</span>
                                   {t.priority === 2 && (
                                      <div className="flex items-center gap-1 mt-1">
                                         <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                         <span className="text-[9px] font-black text-red-400 uppercase">Emergency</span>
                                      </div>
                                   )}
                                   {t.servedBy && <p className="text-[9px] text-slate-500 uppercase font-bold mt-2 tracking-wider">Counter {idx + 1}</p>}
                                </div>
                             </motion.div>
                          )) : (
                             <div className="py-4">
                                <h2 className="text-6xl font-black text-white/5 tracking-tighter italic">WAITING</h2>
                             </div>
                          )}
                       </div>
                   </div>

                   {/* CROWD CHECK */}
                   <div className="nebula-card p-8">
                      <div className="flex justify-between items-center mb-8">
                         <div className="flex items-center gap-3">
                            <div className="bg-purple-500/10 p-2 rounded-xl">
                               <Users size={20} className="text-purple-400" />
                            </div>
                            <h3 className="font-black uppercase text-xs tracking-widest text-slate-200">Crowd Check</h3>
                         </div>
                      </div>
                      <div className="relative mb-6">
                         <select 
                           className="input-nebula text-sm pr-10 appearance-none" 
                           value={statusDept} 
                           onChange={(e) => setStatusDept(e.target.value)}
                         >
                            <option value="">Select Department...</option>
                            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                         </select>
                         <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                            <TrendingUp size={16} />
                         </div>
                      </div>
                      {crowdStatus ? (
                         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                               <div className="flex justify-between items-end mb-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Queue Load</span>
                                  <span className={`font-black text-sm uppercase ${
                                     crowdStatus.crowdLevel === 'Quiet' ? 'text-green-400' : 
                                     crowdStatus.crowdLevel === 'Busy' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>{crowdStatus.crowdLevel}</span>
                               </div>
                               <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: crowdStatus.crowdLevel === 'Quiet' ? '30%' : crowdStatus.crowdLevel === 'Busy' ? '65%' : '95%' }}
                                    className={`h-full ${
                                       crowdStatus.crowdLevel === 'Quiet' ? 'bg-green-500' : 
                                       crowdStatus.crowdLevel === 'Busy' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                  />
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Waiting</p>
                                  <p className="text-xl font-black text-white">{crowdStatus.waitingCount}</p>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Est. Time</p>
                                  <p className="text-xl font-black text-blue-400">{crowdStatus.estimatedWaitTime}m</p>
                               </div>
                            </div>
                         </div>
                      ) : (
                        <div className="h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                           <Info size={24} className="mb-2" />
                           <p className="text-[10px] font-bold uppercase tracking-widest">Select to Analyze</p>
                        </div>
                      )}
                   </div>

                   {/* MY ACHIEVEMENTS */}
                   <div className="nebula-card p-8">
                      <div className="flex justify-between items-center mb-8">
                         <div className="flex items-center gap-3">
                            <div className="bg-amber-500/10 p-2 rounded-xl">
                               <Trophy size={20} className="text-amber-400" />
                            </div>
                            <h3 className="font-black uppercase text-xs tracking-widest text-slate-200">Achievements</h3>
                         </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                         {badges.length > 0 ? badges.map((badge, idx) => (
                            <motion.div 
                               key={idx} 
                               whileHover={{ scale: 1.1, rotate: 5 }}
                               className={`flex items-center gap-2 px-4 py-2 rounded-xl ${badge.bg} border border-white/5 shadow-lg shadow-black/20`}
                            >
                               <badge.icon size={14} className={badge.color} />
                               <span className={`text-[10px] font-black uppercase tracking-wider ${badge.color}`}>{badge.name}</span>
                            </motion.div>
                         )) : (
                            <div className="w-full py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No badges earned yet</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          )}

           {activeTab === "helpdesk" && (
             <StudentHelpdesk departments={departments} onJoinDepartment={handleHelpdeskDepartment} />
           )}

          {activeTab === "join" && (
             <div className="animate-fade-in nebula-card p-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                   <div>
                      <h3 className="text-3xl font-black text-white tracking-tight mb-1">Join a Queue</h3>
                      <p className="text-slate-400 text-sm font-medium">Select a department to get started</p>
                   </div>
                   <div className="flex items-center gap-6 bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /><span className="text-[10px] font-black uppercase text-slate-400">Quiet</span></div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" /><span className="text-[10px] font-black uppercase text-slate-400">Moderate</span></div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" /><span className="text-[10px] font-black uppercase text-slate-400">Busy</span></div>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {departments.map((dept) => (
                      <motion.button
                        key={dept._id}
                        whileHover={{ y: -5, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setJoinDept(dept._id)}
                        className={`p-8 rounded-[2rem] border text-left transition-all relative overflow-hidden group ${
                           joinDept === dept._id 
                           ? "border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]" 
                           : "border-white/5 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                         {/* DYNAMIC HEATMAP GLOW */}
                         <div className={`absolute -right-8 -top-8 w-24 h-24 blur-[40px] opacity-20 rounded-full transition-all group-hover:opacity-40 ${
                            dept.crowdLevel === 'High' ? "bg-red-500" :
                            dept.crowdLevel === 'Moderate' ? "bg-yellow-500" :
                            "bg-green-500"
                         }`} />

                         <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                               <LayoutDashboard size={20} className={joinDept === dept._id ? "text-blue-400" : "text-slate-400"} />
                            </div>
                            {dept.crowdLevel === 'High' && (
                               <div className="bg-red-500/20 text-red-500 p-1.5 rounded-full animate-bounce">
                                  <Flame size={14} />
                               </div>
                            )}
                         </div>

                         <h4 className="font-black text-white text-xl mb-1 relative z-10 tracking-tight">{dept.name}</h4>
                         <div className="flex items-center gap-2 relative z-10">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                               dept.crowdLevel === 'High' ? "text-red-400" :
                               dept.crowdLevel === 'Moderate' ? "text-yellow-400" :
                               "text-green-400"
                            }`}>
                               {dept.crowdLevel === 'High' ? "Busy" : dept.crowdLevel === 'Moderate' ? "Moderate" : "Quiet"}
                            </span>
                         </div>
                         
                         {joinDept === dept._id && (
                            <motion.div 
                               initial={{ opacity: 0, scale: 0.5 }}
                               animate={{ opacity: 1, scale: 1 }}
                               className="absolute bottom-6 right-8 text-blue-400"
                            >
                               <CheckCircle size={24} />
                            </motion.div>
                         )}
                      </motion.button>
                   ))}
                </div>

                {joinDept && chartData.length > 0 && (
                   <div className="mt-10 pt-10 border-t border-[var(--glass-border)]">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                           <TrendingUp size={16} className="text-[var(--accent-primary)]" /> Traffic Forecasting (Live)
                        </h4>
                        <span className="text-[10px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] px-2 py-0.5 rounded-full font-black uppercase">Next 10 Hours</span>
                      </div>
                      
                      <div className="h-48 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <XAxis 
                              dataKey="display" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: 'var(--text-secondary)', opacity: 0.5 }}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              contentStyle={{ 
                                background: '#0f172a', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                fontSize: '12px'
                              }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, index) => {
                                const max = Math.max(...chartData.map(d => d.count), 1);
                                const ratio = entry.count / max;
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={ratio > 0.7 ? '#ef4444' : ratio > 0.3 ? '#f59e0b' : '#10b981'} 
                                    fillOpacity={0.6}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <p className="text-[10px] text-[var(--text-secondary)] mt-4 italic text-center">
                         Smart forecast based on real-time and historical data. Green hours are recommended for faster service.
                      </p>
                   </div>
                )}

                <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/5">
                   <motion.div 
                     whileHover={{ x: 5 }}
                     className="flex items-center gap-4 bg-red-500/5 px-6 py-4 rounded-3xl border border-red-500/10 cursor-pointer group"
                     onClick={() => setShowEmergencyForm(true)}
                   >
                      <div className="bg-red-500/10 p-2 rounded-full text-red-500 group-hover:scale-110 transition-transform">
                         <AlertTriangle size={20} />
                      </div>
                      <div>
                         <p className="text-xs font-black uppercase text-red-500 tracking-widest mb-0.5">Urgent Need?</p>
                         <p className="text-[10px] text-slate-500 font-bold group-hover:text-red-400 transition-colors">Request Priority Assistance</p>
                      </div>
                   </motion.div>
                   
                   <motion.button 
                     whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(37, 99, 235, 0.4)" }}
                     whileTap={{ scale: 0.95 }}
                     onClick={handleJoinQueue} 
                     disabled={!joinDept || !!ticketInfo || !queueOpen} 
                     className="btn-primary py-4 px-12 text-lg shadow-2xl disabled:opacity-50 disabled:grayscale transition-all"
                   >
                     {ticketInfo ? (
                        <div className="flex items-center gap-2">
                           <CheckCircle size={20} /> Already Active
                        </div>
                     ) : (
                        <div className="flex items-center gap-2">
                           Join Queue Now <Zap size={20} className="animate-pulse" />
                        </div>
                     )}
                   </motion.button>
                </div>
             </div>
          )}

          {activeTab === "appointments" && (
            <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* BOOKING FORM */}
              <div className="card p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Calendar className="text-[var(--accent-primary)]" /> Book a Time Slot
                </h3>
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Department</label>
                    <select 
                      className="input-field" 
                      required 
                      value={apptDept} 
                      onChange={(e) => setApptDept(e.target.value)}
                    >
                      <option value="">Select Department...</option>
                      {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Date</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      required 
                      min={new Date().toISOString().split("T")[0]}
                      value={apptDate} 
                      onChange={(e) => setApptDate(e.target.value)}
                    />
                  </div>
                  {apptDept && apptDate && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Available Slots</label>
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setApptTime(slot.time)}
                            className={`p-2 text-xs font-bold rounded-lg border transition-all ${
                              apptTime === slot.time 
                                ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]" 
                                : slot.available 
                                  ? "bg-[var(--bg-secondary)] border-[var(--glass-border)] hover:border-[var(--accent-primary)]" 
                                  : "opacity-30 cursor-not-allowed bg-gray-100"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Purpose of Visit</label>
                    <textarea 
                      className="input-field min-h-[100px]" 
                      required 
                      placeholder="Briefly describe why you're visiting..."
                      value={apptPurpose}
                      onChange={(e) => setApptPurpose(e.target.value)}
                    ></textarea>
                  </div>
                  <button type="submit" className="btn-primary w-full py-4 text-lg" disabled={!apptTime}>
                    Confirm Appointment
                  </button>
                </form>
              </div>

              {/* MY APPOINTMENTS */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="text-[var(--accent-primary)]" /> My Scheduled Visits
                </h3>
                {appointments.length === 0 ? (
                  <div className="card p-10 text-center border-dashed">
                    <p className="text-[var(--text-secondary)]">No upcoming appointments.</p>
                  </div>
                ) : (
                  appointments.map(appt => (
                    <div key={appt._id} className={`card p-6 border-l-4 ${appt.status === "cancelled" ? "border-red-500 opacity-60" : "border-[var(--accent-primary)]"}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-lg">{appt.department?.name}</h4>
                          <p className="text-xs text-[var(--text-secondary)]">{new Date(appt.appointmentDate).toLocaleDateString()} at {appt.timeSlot}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          appt.status === "booked" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                      <p className="text-sm mb-4 text-[var(--text-secondary)] italic">"{appt.purpose}"</p>
                      {appt.status === "booked" && (
                        <button 
                          onClick={() => handleCancelAppointment(appt._id)}
                          className="text-red-500 text-xs font-bold hover:underline"
                        >
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "game" && (
            <div className="animate-fade-in flex items-center justify-center min-h-[500px]">
               <QueueRunner 
                 onGameEnd={() => setActiveTab("dashboard")} 
                 onBadgeEarned={(badgeName) => {
                   setBadges(prev => {
                     if (prev.find(b => b.name === badgeName)) return prev;
                     return [...prev, { name: badgeName, icon: Trophy, color: "text-indigo-500", bg: "bg-indigo-500/10" }];
                   });
                 }}
               />
            </div>
          )}

          {activeTab === "history" && (
             <div className="animate-fade-in space-y-8">
                <div className="card p-0 overflow-hidden">
                   <h3 className="p-6 font-bold border-b border-[var(--glass-border)]">Queue History</h3>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] text-[var(--text-secondary)]">
                            <tr>
                               <th className="px-6 py-4">Ticket</th>
                               <th className="px-6 py-4">Department</th>
                               <th className="px-6 py-4">Status</th>
                               <th className="px-6 py-4">Date</th>
                               <th className="px-6 py-4"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-[var(--glass-border)]">
                            {ticketHistory.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[var(--text-secondary)]">No history.</td></tr> : 
                              ticketHistory.map(t => (
                                 <tr key={t._id}>
                                    <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{t.ticketNumber}</td>
                                    <td className="px-6 py-4">{t.department}</td>
                                    <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                         {t.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">{new Date(t.joinedAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                       {t.status === "completed" && (
                                          <button onClick={() => setFeedbackTicketId(t._id)} className="text-[var(--accent-primary)] font-bold text-xs hover:underline">
                                             Review
                                          </button>
                                       )}
                                    </td>
                                 </tr>
                              ))
                            }
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="card p-0 overflow-hidden">
                   <h3 className="p-6 font-bold border-b border-[var(--glass-border)]">Emergency Requests History</h3>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] text-[var(--text-secondary)]">
                            <tr>
                               <th className="px-6 py-4">Reason</th>
                               <th className="px-6 py-4">Department</th>
                               <th className="px-6 py-4">Status</th>
                               <th className="px-6 py-4">Date</th>
                               <th className="px-6 py-4">Proof</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-[var(--glass-border)]">
                            {emergencyHistory.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[var(--text-secondary)]">No emergency history.</td></tr> : 
                              emergencyHistory.map(e => (
                                 <tr key={e._id}>
                                    <td className="px-6 py-4 text-[var(--text-primary)] font-medium max-w-xs truncate">{e.reason}</td>
                                    <td className="px-6 py-4">{e.department?.name || "N/A"}</td>
                                    <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                        e.status === 'resolved' ? 'bg-green-500 text-white' : 
                                        e.status === 'rejected' ? 'bg-red-500 text-white' : 
                                        e.status === 'active' ? 'bg-yellow-500 text-black animate-pulse' : 
                                        'bg-slate-500 text-white'
                                      }`}>
                                         {e.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs opacity-60">{new Date(e.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                       {e.proof && (
                                          <a 
                                            href={`${import.meta.env.VITE_API_URL.replace("/api", "")}${e.proof}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-[var(--accent-primary)] font-bold text-xs hover:underline"
                                          >
                                             View
                                          </a>
                                       )}
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

          {/* MODALS */}
          {feedbackTicketId && <FeedbackModal ticketId={feedbackTicketId} onClose={() => setFeedbackTicketId(null)} onSubmit={handleSubmitFeedback} />}
          
          {showEmergencyForm && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                   <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">Request Priority Assistance</h3>
                   <p className="text-xs text-[var(--text-secondary)] mb-4 italic">Providing a clear description and proof (JPEG/PDF) is mandatory for approval.</p>
                   <textarea 
                     className="input-field mb-4 bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-primary)]" 
                     placeholder="Detailed description of your emergency..." 
                     value={emergencyReason} 
                     required
                     onChange={e => setEmergencyReason(e.target.value)} 
                   />
                   <div className="mb-6 relative">
                      <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Upload Proof (JPEG or PDF)</label>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,application/pdf"
                        required
                        onChange={e => setEmergencyProof(e.target.files[0])} 
                        className="block w-full text-sm text-[var(--text-secondary)]
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-[var(--accent-primary)] file:text-white
                          hover:file:bg-[var(--accent-primary)]/80 cursor-pointer" 
                      />
                   </div>
                   <div className="flex gap-4">
                      <button onClick={() => setShowEmergencyForm(false)} className="flex-1 py-3 text-[var(--text-secondary)] font-bold hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                      <button onClick={handleSubmitEmergencyForm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-600/20">Submit Request</button>
                   </div>
                </div>
             </div>
          )}

          {showDeflection && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
                >
                   <div className="w-16 h-16 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full flex items-center justify-center mb-6">
                      <Zap size={32} className="animate-pulse" />
                   </div>
                   <h3 className="text-xl font-bold mb-4">{deflectionContent?.title}</h3>
                   <p className="text-[var(--text-secondary)] text-sm mb-6">{deflectionContent?.advice}</p>
                   
                   <div className="space-y-4">
                      <a 
                        href={deflectionContent?.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="block w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-center font-bold hover:bg-white/10 transition-all"
                      >
                         🌐 {deflectionContent?.label}
                      </a>
                      <div className="pt-2 border-t border-[var(--glass-border)]">
                         <p className="text-[10px] text-[var(--text-secondary)] uppercase font-black text-center mb-4">Still need to join the queue?</p>
                         <div className="flex gap-4">
                            <button onClick={() => setShowDeflection(false)} className="flex-1 py-3 text-red-500 font-bold hover:underline">Cancel</button>
                            <button onClick={proceedToJoin} className="flex-1 py-3 bg-[var(--accent-primary)] text-white rounded-xl font-bold">Join Anyway</button>
                         </div>
                      </div>
                   </div>
                </motion.div>
             </div>
          )}

          {message && (
             <div className="fixed bottom-6 right-6 z-50 bg-slate-900 arrow-fade-in text-white px-6 py-3 rounded-xl shadow-lg">
                {message}
             </div>
          )}

       </main>
    </div>
  );
}
