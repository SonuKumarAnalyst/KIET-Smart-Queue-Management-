import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createDepartment,
  getDepartments,
  getStaffUsers,
  assignStaffToDepartment,
  updateDepartment,
  deleteDepartment,
  getAuditLogs,
  getStaffLoadBalancing,
} from "../../services/admin";
import { LayoutDashboard, Users, MessageSquare, Settings, Plus, UserPlus, BarChart3, Edit2, Trash2, X, ShieldCheck, Clock, User, Building, Scale, ArrowRight, AlertCircle, RotateCcw, CheckCircle } from "lucide-react";
import DashboardSidebar from "../../components/DashboardSidebar";
import AdminAnalytics from "../../components/admin/AdminAnalytics";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editingDept, setEditingDept] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDescription] = useState("");

  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);

  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadBalancing, setLoadBalancing] = useState({ departmentLoad: [], suggestions: [] });

  /* =========================
     FETCH DATA
  ========================= */
  useEffect(() => {
    fetchDepartments();
    fetchStaff();
    fetchFeedback();
    fetchAuditLogs();
    fetchLoadBalancing();
  }, []);

  const fetchLoadBalancing = async () => {
    try {
      const data = await getStaffLoadBalancing();
      setLoadBalancing(data);
    } catch {
      console.error("Failed to load load balancing data");
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await getAuditLogs();
      setAuditLogs(data);
    } catch {
      console.error("Failed to load audit logs");
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch {
      setMessage("Failed to load departments");
    }
  };

  const fetchStaff = async () => {
    try {
      const data = await getStaffUsers();
      setStaff(data);
    } catch {
      setMessage("Failed to load staff");
    }
  };

  const fetchFeedback = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/feedback", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error("Feedback fetch failed", err);
    }
  };

  /* =========================
     ACTIONS
  ========================= */
  const handleCreateDepartment = async () => {
    if (!name.trim()) return setMessage("Department name is required");
    try {
      setLoading(true);
      const data = await createDepartment({ name, description });
      setMessage(data.message);
      setName("");
      setDescription("");
      fetchDepartments();
    } catch (err) {
      setMessage(err.response?.data?.message || "Error creating department");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!selectedStaff || !selectedDepartment) return setMessage("Select both staff and department");
    try {
      setLoading(true);
      const data = await assignStaffToDepartment({
        staffId: selectedStaff,
        departmentId: selectedDepartment,
      });
      setMessage(data.message);
      setSelectedStaff("");
      setSelectedDepartment("");
      fetchDepartments();
      fetchStaff();
    } catch (err) {
      setMessage(err.response?.data?.message || "Assignment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editName.trim()) return setMessage("Name required");
    try {
      setLoading(true);
      await updateDepartment(editingDept._id, { name: editName, description: editDesc });
      setMessage("Department updated");
      setEditingDept(null);
      fetchDepartments();
    } catch {
      setMessage("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("Are you sure? This will delete the queue and unassign staff.")) return;
    try {
      await deleteDepartment(id);
      setMessage("Department deleted");
      fetchDepartments();
    } catch {
      setMessage("Delete failed");
    }
  };

  const startEditing = (dept) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDescription(dept.description || "");
  };

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "staff", label: "Manage Staff", icon: Users },
    { id: "balancing", label: "Load Balancing", icon: Scale },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "audit", label: "Audit Logs", icon: ShieldCheck },
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
       <DashboardSidebar title="Admin Panel" tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
       
       <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 transition-all duration-300 relative">
         
         <AnimatePresence mode="wait">
           <motion.div
             key={activeTab}
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.98 }}
             transition={{ duration: 0.2, ease: "easeOut" }}
           >
             {/* MESSAGE TOAST */}
         {message && (
            <div className="fixed bottom-6 right-6 z-50 animate-fade-in bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
               <span className="text-green-400">✓</span>
               <p>{message}</p>
               <button onClick={() => setMessage("")} className="ml-2 text-xs opacity-50 hover:opacity-100">✕</button>
            </div>
         )}


         {/* =======================
             TAB: ANALYTICS
         ======================== */}
         {activeTab === "analytics" && <AdminAnalytics />}

         {/* =======================
             TAB: OVERVIEW (DEPARTMENTS)
         ======================== */}
         {activeTab === "overview" && (
           <div className="animate-fade-in">
              <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)]">Departments</h1>
                    <p className="text-[var(--text-secondary)] mt-1">Manage departmental queues and settings.</p>
                 </div>
                 <input
                    type="text"
                    placeholder="Search departments..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field max-w-xs"
                 />
              </header>

              {/* Create Dept Section */}
              <div className="mb-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 md:p-8">
                 <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
                   <Plus size={20} className="text-[var(--accent-primary)]"/> Create New Department
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      placeholder="Department Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                    />
                    <input
                      placeholder="Description (Optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="input-field"
                    />
                    <button
                      onClick={handleCreateDepartment}
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? "Creating..." : "Create"}
                    </button>
                 </div>
              </div>

              {/* List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredDepartments.map((dept) => (
                    <div key={dept._id} className="card hover:border-[var(--accent-primary)] transition-colors group">
                       <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg text-[var(--text-primary)]">{dept.name}</h3>
                          <div className="flex gap-2">
                             <button onClick={() => startEditing(dept)} className="p-1.5 rounded-lg hover:bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 size={14} />
                             </button>
                             <button onClick={() => handleDeleteDepartment(dept._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                             </button>
                          </div>
                       </div>
                       <p className="text-sm text-[var(--text-secondary)] mb-4 min-h-[40px]">
                          {dept.description || "No description."}
                       </p>
                       <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] border-t border-[var(--glass-border)] pt-3">
                          <span>{dept.staff?.length || 0} Staff</span>
                          <span className="font-mono opacity-50">{dept._id.slice(-6)}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
         )}

         {/* EDIT MODAL */}
         {editingDept && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="card w-full max-w-md p-8 shadow-2xl scale-in-center">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold text-[var(--text-primary)]">Edit Department</h3>
                     <button onClick={() => setEditingDept(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">Name</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)} className="input-field" />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">Description</label>
                        <textarea value={editDesc} onChange={e => setEditDescription(e.target.value)} className="input-field min-h-[100px]" />
                     </div>
                     <div className="pt-4 flex gap-3">
                        <button onClick={() => setEditingDept(null)} className="btn-secondary flex-1">Cancel</button>
                        <button onClick={handleUpdateDepartment} disabled={loading} className="btn-primary flex-1">
                           {loading ? "Updating..." : "Save Changes"}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}


         {/* =======================
             TAB: STAFF MANAGEMENT
         ======================== */}
         {activeTab === "staff" && (
           <div className="animate-fade-in">
              <header className="mb-10">
                 <h1 className="text-3xl font-bold text-[var(--text-primary)]">Staff Assignment</h1>
                 <p className="text-[var(--text-secondary)] mt-1">Assign staff members to departments.</p>
              </header>

              <div className="max-w-2xl mx-auto card p-8 mb-10">
                 <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
                   <UserPlus size={20} className="text-[var(--accent-secondary)]"/> Assign Staff
                 </h3>
                 <div className="space-y-6">
                    <div>
                       <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Staff</label>
                       <select
                          value={selectedStaff}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="input-field"
                       >
                          <option value="">Choose a user...</option>
                          {staff.map((s) => (
                             <option key={s._id} value={s._id}>{s.fullName} ({s.email})</option>
                          ))}
                       </select>
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Department</label>
                       <select
                          value={selectedDepartment}
                          onChange={(e) => setSelectedDepartment(e.target.value)}
                          className="input-field"
                       >
                          <option value="">Choose a department...</option>
                          {departments.map((d) => (
                             <option key={d._id} value={d._id}>{d.name}</option>
                          ))}
                       </select>
                    </div>

                    <button disabled={loading} onClick={handleAssignStaff} className="btn-primary w-full">
                       {loading ? "Assigning..." : "Assign to Department"}
                    </button>
                 </div>
              </div>
           </div>
         )}


         {/* =======================
             TAB: FEEDBACK
         ======================== */}
         {activeTab === "feedback" && (
            <div className="animate-fade-in">
               <header className="mb-10">
                  <h1 className="text-3xl font-bold text-[var(--text-primary)]">Student Feedback</h1>
                  <p className="text-[var(--text-secondary)] mt-1">Review ratings and comments from students.</p>
               </header>

               <div className="card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium border-b border-[var(--glass-border)]">
                        <tr>
                          <th className="px-6 py-4">Ticket</th>
                          <th className="px-6 py-4">Department</th>
                          <th className="px-6 py-4">Sentiment</th>
                          <th className="px-6 py-4">Comment</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--glass-border)]">
                        {feedback.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-[var(--text-secondary)]">No feedback found.</td></tr>
                        ) : feedback.map((f) => (
                          <tr key={f._id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{f.ticketNumber}</td>
                            <td className="px-6 py-4">{f.department}</td>
                            <td className="px-6 py-4">
                               <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${
                                  f.sentiment === 'positive' ? 'bg-green-500/10 text-green-500' :
                                  f.sentiment === 'negative' ? 'bg-red-500/10 text-red-500' :
                                  'bg-blue-500/10 text-blue-500'
                               }`}>
                                  {f.sentiment || "neutral"}
                               </span>
                            </td>
                            <td className="px-6 py-4 max-w-xs truncate" title={f.comment}>{f.comment || "--"}</td>
                            <td className="px-6 py-4 opacity-70">{new Date(f.submittedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
         )}

         {/* =======================
             TAB: LOAD BALANCING
         ======================== */}
         {activeTab === "balancing" && (
            <div className="animate-fade-in space-y-12">
               <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                  <div>
                     <h1 className="text-4xl font-black text-white tracking-tight">Resource Optimization</h1>
                     <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
                        <Scale size={16} className="text-blue-400" /> Real-time staff load balancing and re-allocation.
                     </p>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchLoadBalancing} 
                    className="btn-nebula px-8 py-3 flex items-center gap-3 border-blue-500/30 text-blue-400"
                  >
                     <RotateCcw size={18} className="animate-spin-slow" /> Refresh Analysis
                  </motion.button>
               </header>

               {/* SUGGESTIONS & OVERVIEW */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="nebula-card p-10 border-amber-500/20 bg-amber-500/5 relative overflow-hidden group">
                     <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 blur-[80px] rounded-full" />
                     <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-amber-500">
                        <AlertCircle size={24} /> AI Suggestions
                     </h3>
                     <div className="space-y-6 relative z-10">
                        {loadBalancing.suggestions.length === 0 ? (
                           <div className="p-16 text-center">
                              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                 <CheckCircle size={32} className="text-green-500" />
                              </div>
                              <p className="text-slate-400 font-bold italic">Perfectly Balanced</p>
                              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-2">No re-allocation needed</p>
                           </div>
                        ) : (
                           loadBalancing.suggestions.map((s, i) => (
                              <motion.div 
                                key={i} 
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-slate-900/60 p-6 rounded-[2rem] border border-white/5 flex flex-col gap-4 shadow-2xl"
                              >
                                 <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recommendation #{i+1}</span>
                                    <span className="bg-amber-500 text-white text-[9px] px-3 py-1 rounded-full font-black uppercase animate-pulse-soft shadow-[0_0_15px_rgba(245,158,11,0.3)]">Move Staff</span>
                                 </div>
                                 <div className="flex items-center gap-6">
                                    <div className="flex-1">
                                       <p className="text-[9px] text-slate-500 uppercase font-black mb-2 tracking-widest">Quiet Zone</p>
                                       <p className="font-black text-white text-lg">{s.from}</p>
                                    </div>
                                    <div className="bg-amber-500/10 p-2 rounded-full border border-amber-500/20">
                                       <ArrowRight className="text-amber-500" size={20} />
                                    </div>
                                    <div className="flex-1 text-right">
                                       <p className="text-[9px] text-slate-500 uppercase font-black mb-2 tracking-widest">Congested Zone</p>
                                       <p className="font-black text-white text-lg">{s.to}</p>
                                    </div>
                                 </div>
                                 <div className="pt-4 border-t border-white/5 text-sm font-medium text-slate-400 italic leading-relaxed">
                                    "{s.reason}"
                                 </div>
                              </motion.div>
                           ))
                        )}
                     </div>
                  </div>

                  <div className="nebula-card p-10">
                     <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-white">
                        <Scale size={24} className="text-blue-400" /> System Load Heatmap
                     </h3>
                     <div className="space-y-8">
                        {loadBalancing.departmentLoad.slice(0, 5).map((d, i) => (
                           <div key={i} className="group">
                              <div className="flex justify-between items-end mb-3">
                                 <div>
                                    <p className="font-black text-white group-hover:text-blue-400 transition-colors">{d.departmentName}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                       <span className="text-[10px] text-slate-500 font-bold uppercase">{d.staffCount} Staff</span>
                                       <div className="w-1 h-1 rounded-full bg-slate-700" />
                                       <span className="text-[10px] text-slate-500 font-bold uppercase">{d.waitingCount} Waiting</span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg tracking-widest ${
                                       d.status === 'congested' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                                       d.status === 'quiet' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                                       'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                                    }`}>{d.status}</span>
                                    <p className="text-[9px] font-black text-slate-600 mt-2 uppercase">Score: {d.loadScore}</p>
                                 </div>
                              </div>
                              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, d.loadScore * 10)}%` }}
                                    className={`h-full rounded-full shadow-lg ${
                                       d.status === 'congested' ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-red-500/20' :
                                       d.status === 'quiet' ? 'bg-gradient-to-r from-green-600 to-green-400 shadow-green-500/20' : 
                                       'bg-gradient-to-r from-blue-600 to-blue-400 shadow-blue-500/20'
                                    }`}
                                 />
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* DETAILED ANALYSIS TABLE */}
               <div className="nebula-card overflow-hidden border-white/5">
                  <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                     <h3 className="font-black text-white uppercase tracking-widest text-xs">Granular Metrics Analysis</h3>
                     <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-900 px-3 py-1 rounded-full border border-white/5">Real-time Feed</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400 font-black uppercase tracking-widest text-[10px] border-b border-white/5">
                           <tr>
                              <th className="px-8 py-5">Department Entity</th>
                              <th className="px-8 py-5 text-center">Load Factor</th>
                              <th className="px-8 py-5 text-center">Active Nodes</th>
                              <th className="px-8 py-5 text-center">Queue Depth</th>
                              <th className="px-8 py-5 text-right">Integrity</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {loadBalancing.departmentLoad.map((d) => (
                              <tr key={d.departmentId} className="hover:bg-white/5 transition-all duration-300 group">
                                 <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                       <div className={`w-2 h-2 rounded-full ${
                                          d.status === 'congested' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                          d.status === 'quiet' ? 'bg-green-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                          'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                                       }`} />
                                       <span className="font-black text-white text-base group-hover:text-blue-400 transition-colors">{d.departmentName}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6 text-center font-mono text-slate-400">
                                    <span className={`font-black ${d.loadScore > 5 ? 'text-red-400' : 'text-blue-400'}`}>{d.loadScore}</span>
                                    <span className="text-[9px] ml-1 opacity-30">L/F</span>
                                 </td>
                                 <td className="px-8 py-6 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                       <Users size={12} className="text-slate-500" />
                                       <span className="font-bold text-white">{d.staffCount}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6 text-center">
                                    <span className="bg-white/5 px-3 py-1 rounded-full text-xs font-black text-slate-300 border border-white/5">
                                       {d.waitingCount}
                                    </span>
                                 </td>
                                 <td className="px-8 py-6 text-right">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                                       d.status === 'congested' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                       d.status === 'quiet' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                       'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                       {d.status === 'congested' ? 'Critical' : d.status === 'quiet' ? 'Stable' : 'Optimal'}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* =======================
             TAB: AUDIT LOGS
         ======================== */}
         {activeTab === "audit" && (
            <div className="animate-fade-in">
               <header className="mb-10">
                  <h1 className="text-3xl font-bold text-[var(--text-primary)]">Audit Logs</h1>
                  <p className="text-[var(--text-secondary)] mt-1">Track administrative actions and system changes.</p>
               </header>

               <div className="card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium border-b border-[var(--glass-border)]">
                        <tr>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Admin</th>
                          <th className="px-6 py-4">Details</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--glass-border)]">
                        {auditLogs.length === 0 ? (
                          <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-secondary)]">No logs found.</td></tr>
                        ) : auditLogs.map((log) => (
                          <tr key={log._id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                               <span className={`px-2 py-1 rounded text-[10px] font-black ${
                                  log.action.includes('DELETE') ? 'bg-red-500/10 text-red-500' :
                                  log.action.includes('CREATE') ? 'bg-green-500/10 text-green-500' :
                                  'bg-blue-500/10 text-blue-500'
                               }`}>
                                  {log.action}
                               </span>
                            </td>
                            <td className="px-6 py-4 font-medium">{log.performedBy?.fullName || "System"}</td>
                            <td className="px-6 py-4 text-[var(--text-secondary)]">{log.details}</td>
                            <td className="px-6 py-4 opacity-70 flex items-center gap-2">
                               <Clock size={12}/> {new Date(log.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
         )}
         </motion.div>
         </AnimatePresence>

       </main>
    </div>
  );
}
