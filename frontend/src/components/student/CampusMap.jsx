import React, { useEffect, useState } from 'react';
import { MapPin, Users, Clock } from 'lucide-react';
import { getCrowdStatus } from '../../services/student';

export default function CampusMap({ departments }) {
  const [departmentStatus, setDepartmentStatus] = useState({});

  useEffect(() => {
    const fetchStatuses = async () => {
      const statuses = {};
      for (const dept of departments) {
        try {
          const status = await getCrowdStatus(dept._id);
          statuses[dept._id] = status;
        } catch (err) {
          console.error(`Failed to fetch status for ${dept._id}:`, err);
        }
      }
      setDepartmentStatus(statuses);
    };

    if (departments.length > 0) {
      fetchStatuses();
    }
  }, [departments]);

  const getHeatColor = (level) => {
    switch (level) {
      case 'RED': return 'bg-red-500 shadow-red-500/50';
      case 'YELLOW': return 'bg-yellow-500 shadow-yellow-500/50';
      default: return 'bg-green-500 shadow-green-500/50';
    }
  };

  return (
    <div className="relative w-full aspect-video bg-slate-800 rounded-3xl overflow-hidden border-4 border-[var(--glass-border)] shadow-2xl group">
      {/* MAP BACKGROUND GRID */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      {/* CAMPUS PATHS (Abstract) */}
      <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 100 100">
        <path d="M10,50 L90,50 M50,10 L50,90 M30,30 L70,70 M30,70 L70,30" stroke="white" strokeWidth="0.5" fill="none" />
      </svg>

      {/* DEPARTMENT NODES */}
      {departments.map((dept) => {
        const status = departmentStatus[dept._id] || { crowdLevel: 'GREEN', estimatedWaitTime: 0, queueLength: 0 };
        return (
          <div
            key={dept._id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group/pin cursor-pointer"
            style={{ left: `${dept.location?.x || 50}%`, top: `${dept.location?.y || 50}%` }}
          >
            {/* PULSING RADIUS */}
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${getHeatColor(status.crowdLevel)}`}></div>
            
            {/* MAIN PIN */}
            <div className={`relative p-2 rounded-full border-2 border-white/20 shadow-lg transition-transform group-hover/pin:scale-125 ${getHeatColor(status.crowdLevel)}`}>
              <MapPin size={16} className="text-white" />
            </div>

            {/* TOOLTIP */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-xl opacity-0 pointer-events-none group-hover/pin:opacity-100 transition-opacity z-10 shadow-2xl">
              <h4 className="font-bold text-white text-sm mb-1">{dept.name}</h4>
              <div className="flex items-center justify-between text-[10px] text-white/70">
                <span className="flex items-center gap-1"><Users size={10}/> {status.queueLength} in line</span>
                <span className="flex items-center gap-1 text-[var(--accent-primary)] font-bold"><Clock size={10}/> {status.estimatedWaitTime} min</span>
              </div>
              <div className={`mt-2 h-1 w-full rounded-full overflow-hidden bg-white/10`}>
                <div 
                  className={`h-full transition-all duration-1000 ${getHeatColor(status.crowdLevel)}`}
                  style={{ width: `${Math.min(100, (status.estimatedWaitTime / 40) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10">
        <h4 className="text-[10px] font-bold text-white/50 uppercase mb-2">Crowd Legend</h4>
        <div className="space-y-1.5 text-[10px] text-white">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Low Traffic</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Moderate</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> High Traffic</div>
        </div>
      </div>
    </div>
  );
}
