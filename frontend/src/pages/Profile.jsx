import { useEffect, useState } from "react";
import { User, Mail, Shield, Building, Calendar, Edit2, Check, X, Lock, Activity, QrCode, BarChart3, ShieldCheck } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import DashboardSidebar from "../components/DashboardSidebar";
import { LayoutDashboard, PlusCircle, RotateCcw as LucideHistoryIcon, Settings, Users, MessageSquare } from "lucide-react";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/auth/profile");
      setProfile(res.data);
      setFullName(res.data.fullName);
      setEmail(res.data.email);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put("/auth/profile", { fullName, email, password });
      toast.success("Profile updated!");
      setEditing(false);
      setPassword("");
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading profile...</div>;

  const tabs = profile.role === "admin" ? [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "staff", label: "Manage Staff", icon: Users },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "audit", label: "Audit Logs", icon: ShieldCheck },
    { id: "profile", label: "My Profile", icon: User },
  ] : profile.role === "staff" ? [
    { id: "overview", label: "Queue Visuals", icon: Activity },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "history", label: "Emergency History", icon: LucideHistoryIcon },
    { id: "settings", label: "Queue Settings", icon: Settings },
    { id: "qr", label: "QR Generator", icon: QrCode },
    { id: "profile", label: "My Profile", icon: User },
  ] : [
    { id: "dashboard", label: "Queue Visuals", icon: LayoutDashboard },
    { id: "join", label: "Join Queue", icon: PlusCircle },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "history", label: "My History", icon: LucideHistoryIcon },
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <DashboardSidebar 
        title={profile.role.toUpperCase() + " Panel"} 
        tabs={tabs} 
        activeTab="profile" 
        setActiveTab={() => window.location.href = `/#/${profile.role}`} 
      />

      <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 transition-all duration-300">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Profile</h1>
          <p className="text-[var(--text-secondary)] mt-1">Manage your account information and security.</p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* PROFILE CARD */}
            <div className="lg:col-span-1">
              <div className="card text-center p-8 sticky top-10">
                <div className="w-24 h-24 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-[var(--accent-primary)]/20 shadow-xl">
                  <User size={48} />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{profile.fullName}</h2>
                <p className="text-xs font-black uppercase text-[var(--text-secondary)] mt-1 tracking-widest">{profile.role}</p>
                
                <div className="mt-8 pt-8 border-t border-[var(--glass-border)] space-y-4 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)] truncate">{profile.email}</span>
                  </div>
                  {profile.department && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building size={16} className="text-[var(--text-secondary)]" />
                      <span className="text-[var(--text-primary)]">{profile.department.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)]">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* EDIT SECTION */}
            <div className="lg:col-span-2">
              <div className="card p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Settings size={20} className="text-[var(--accent-primary)]" />
                    Account Settings
                  </h3>
                  {!editing ? (
                    <button onClick={() => setEditing(true)} className="btn-secondary py-2 px-4 flex items-center gap-2 text-sm">
                      <Edit2 size={14} /> Edit Profile
                    </button>
                  ) : (
                    <button onClick={() => setEditing(false)} className="text-red-500 hover:underline text-sm font-bold">
                      Cancel
                    </button>
                  )}
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Full Name</label>
                      <input 
                        disabled={!editing}
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className={`input-field ${!editing && 'opacity-60 cursor-not-allowed bg-transparent'}`} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Email Address</label>
                      <input 
                        type="email"
                        disabled={!editing}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={`input-field ${!editing && 'opacity-60 cursor-not-allowed bg-transparent'}`} 
                      />
                    </div>
                  </div>

                  {editing && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block flex items-center gap-2">
                        <Lock size={12} /> New Password (leave blank to keep current)
                      </label>
                      <input 
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field" 
                      />
                    </div>
                  )}

                  {editing && (
                    <div className="pt-4 border-t border-[var(--glass-border)]">
                      <button type="submit" className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                        <Check size={18} /> Save All Changes
                      </button>
                    </div>
                  )}
                </form>

                {!editing && (
                  <div className="mt-10 p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Shield size={16} className="text-blue-500" />
                      Data Privacy
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Your profile information is used only for KIET Smart Queue operations and notifications.
                      You can request to have your account deactivated by contacting the campus administrator.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
