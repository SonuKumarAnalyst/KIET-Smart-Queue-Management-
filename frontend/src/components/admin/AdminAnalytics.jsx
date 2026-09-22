import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { getAnalytics, getPredictiveStaffing } from '../../services/admin';
import { socket } from '../../services/socket';
import { BarChart as BarChartIcon, Clock, TrendingUp, Users, CheckCircle, AlertTriangle, Star, PieChart as PieChartIcon } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [staffingAlerts, setStaffingAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchStaffingAlerts();
    socket.emit("join_admin");
    socket.on("update_analytics", () => {
      fetchData();
      fetchStaffingAlerts();
    });
    return () => socket.off("update_analytics");
  }, []);

  const fetchStaffingAlerts = async () => {
    try {
      const res = await getPredictiveStaffing();
      setStaffingAlerts(res.alerts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      const analytics = await getAnalytics();
      setData(analytics);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-[var(--text-secondary)]">Loading analytics...</div>;
  if (!data) return <div className="p-10 text-center text-red-400">Failed to load analytics.</div>;

  const stats = data.overallStats || { total: 0, waiting: 0, serving: 0, completed: 0, noShow: 0 };

  // Prepare chart data
  const hourlyData = Array.from({ length: 24 }).map((_, hour) => {
    const found = data.peakHours?.find(h => h._id === hour);
    return { hour: `${hour}:00`, count: found ? found.count : 0 };
  });

  const deptData = data.deptVolume?.map(d => ({ name: d._id, value: d.count })) || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <Motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative space-y-8 pb-10"
    >
      {/* PREDICTIVE STAFFING ALERTS */}
      {staffingAlerts.length > 0 && (
        <Motion.div variants={itemVariants} className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl">
           <div className="flex items-center gap-2 text-amber-500 mb-4">
              <AlertTriangle size={20} />
              <h3 className="font-bold uppercase tracking-wider text-xs">AI Staffing Recommendations</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffingAlerts.map((alert, idx) => (
                <div key={idx} className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] p-4 rounded-2xl">
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase text-[var(--text-secondary)]">{alert.day} @ {alert.hour}:00</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${alert.severity === 'High' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {alert.severity} Spike
                      </span>
                   </div>
                   <p className="text-sm font-bold text-[var(--text-primary)] mb-1">~{alert.predictedVolume} Expected Tickets</p>
                   <p className="text-xs text-[var(--text-secondary)] italic">{alert.recommendation}</p>
                </div>
              ))}
           </div>
        </Motion.div>
      )}

      {/* REALTIME COUNTERS */}
      <Motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card p-5 text-center bg-blue-500/5 border-blue-500/20">
          <p className="text-[10px] font-bold uppercase text-blue-500 mb-1 tracking-widest">Today Total</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">{stats.total}</h4>
        </div>
        <div className="card p-5 text-center bg-yellow-500/5 border-yellow-500/20">
          <p className="text-[10px] font-bold uppercase text-yellow-500 mb-1 tracking-widest">Waiting</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">{stats.waiting}</h4>
        </div>
        <div className="card p-5 text-center bg-purple-500/5 border-purple-500/20">
          <p className="text-[10px] font-bold uppercase text-purple-500 mb-1 tracking-widest">Serving</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">{stats.serving}</h4>
        </div>
        <div className="card p-5 text-center bg-green-500/5 border-green-500/20">
          <p className="text-[10px] font-bold uppercase text-green-500 mb-1 tracking-widest">Completed</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">{stats.completed}</h4>
        </div>
        <div className="card p-5 text-center bg-red-500/5 border-red-500/20 md:hidden lg:block">
          <p className="text-[10px] font-bold uppercase text-red-500 mb-1 tracking-widest">No-Shows</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">{stats.noShow}</h4>
        </div>
        {/* KPI: AVG WAIT */}
        <div className="card p-5 text-center bg-indigo-500/5 border-indigo-500/20">
          <p className="text-[10px] font-bold uppercase text-indigo-500 mb-1 tracking-widest">Avg Wait</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">
             {Math.round(data.avgMetrics?.avgWait || 0)}m
          </h4>
        </div>
        {/* KPI: AVG SERVICE */}
        <div className="card p-5 text-center bg-cyan-500/5 border-cyan-500/20">
          <p className="text-[10px] font-bold uppercase text-cyan-500 mb-1 tracking-widest">Avg Service</p>
          <h4 className="text-3xl font-black text-[var(--text-primary)]">
             {Math.round(data.avgMetrics?.avgService || 0)}m
          </h4>
        </div>
      </Motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hourly Traffic - Area Chart */}
        <Motion.div variants={itemVariants} className="card p-6 min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-[var(--accent-primary)]"/> Daily Traffic Pattern
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#6366f1' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Motion.div>

        {/* Department Volume - Pie Chart */}
        <Motion.div variants={itemVariants} className="card p-6 min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
            <PieChartIcon size={20} className="text-[var(--accent-secondary)]"/> Department Distribution
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deptData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Motion.div>

        {/* Staff Performance - Bar Chart */}
        <Motion.div variants={itemVariants} className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500"/> Staff Resolution Efficiency
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.staffPerformance?.map(s => ({ name: s._id, tickets: s.ticketsServed, time: Math.round(s.avgResolutionTime || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="tickets" fill="#10b981" radius={[4, 4, 0, 0]} name="Tickets Served" />
                <Bar dataKey="time" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Time (m)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Motion.div>

        {/* STAFF LEADERBOARD / PERFORMANCE HIGHLIGHTS */}
        <Motion.div variants={itemVariants} className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="card p-6 border-green-500/10">
              <h3 className="text-sm font-bold uppercase tracking-widest text-green-500 mb-6 flex items-center gap-2">
                 <Star size={16} /> Most Productive Staff
              </h3>
              <div className="space-y-4">
                 {data.staffPerformance?.sort((a,b) => b.ticketsServed - a.ticketsServed).slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-black text-xs">#{i+1}</div>
                          <p className="text-sm font-bold">{s._id}</p>
                       </div>
                       <p className="text-xs font-black text-green-500">{s.ticketsServed} TICKETS</p>
                    </div>
                 ))}
              </div>
           </div>

           <div className="card p-6 border-amber-500/10">
              <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-6 flex items-center gap-2">
                 <Clock size={16} /> Fastest Service Time
              </h3>
              <div className="space-y-4">
                 {data.staffPerformance?.filter(s => s.ticketsServed > 0).sort((a,b) => a.avgResolutionTime - b.avgResolutionTime).slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-xs">#{i+1}</div>
                          <div>
                             <p className="text-sm font-bold flex items-center gap-2">
                               {s._id} 
                               <span className="text-base" title="Current Mood based on resolution speed">
                                 {s.avgResolutionTime < 10 ? '😊' : s.avgResolutionTime < 20 ? '😐' : '😟'}
                               </span>
                             </p>
                             <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">Efficiency Mode</p>
                          </div>
                       </div>
                       <p className="text-xs font-black text-amber-500">~{Math.round(s.avgResolutionTime || 0)} MIN/TICKET</p>
                    </div>
                 ))}
              </div>
           </div>
        </Motion.div>
      </div>
    </Motion.div>
  );
};

export default AdminAnalytics;
